# Corridor Planner V4 — PostGIS Architecture

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema (Prisma + PostGIS)](#2-database-schema)
3. [AI System Prompt (Human-in-the-Loop)](#3-ai-system-prompt)
4. [Frontend Hooks (Turf.js Spatial Logic)](#4-frontend-hooks)
5. [Migration Plan (localStorage → Supabase)](#5-migration-plan)
6. [Supabase Setup](#6-supabase-setup)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                  │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Leaflet  │  │ leaflet-ant  │  │  leaflet-    │              │
│  │  Map     │  │   -path      │  │   draw       │              │
│  │          │  │ (animated    │  │ (polygon/    │              │
│  │          │  │  corridors)  │  │  pin edit)   │              │
│  └────┬─────┘  └──────┬───────┘  └──────┬───────┘              │
│       │               │                 │                       │
│  ┌────┴───────────────┴─────────────────┴───────────┐          │
│  │              State Management Layer               │          │
│  │                                                   │          │
│  │  useCorridorManager()   useDraftItems()           │          │
│  │  useIncidentEditor()    useSpatialQuery()         │          │
│  │                                                   │          │
│  │  Turf.js: buffer(), booleanPointInPolygon(),      │          │
│  │           lineString(), along(), length()         │          │
│  └────────────────────┬──────────────────────────────┘          │
│                       │                                         │
│               Supabase Client SDK                               │
│               (Realtime subscriptions)                          │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTPS + WebSocket (Realtime)
┌───────────────────────┴─────────────────────────────────────────┐
│                    SUPABASE (Backend)                            │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Auth (RLS)  │  │  Realtime    │  │  Edge Functions      │  │
│  │  JWT tokens  │  │  Postgres    │  │  (AI proxy,          │  │
│  │              │  │  Changes     │  │   geocoding batch)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          PostgreSQL 15 + PostGIS 3.4                      │  │
│  │                                                           │  │
│  │  Tables:                                                  │  │
│  │    workspace     (org/team container)                     │  │
│  │    operation     (crisis event)                           │  │
│  │    corridor      (route LineString)                       │  │
│  │    waypoint      (nodes along corridor)                   │  │
│  │    incident      (Point or Polygon)                       │  │
│  │    brief         (source text, parsed status)             │  │
│  │    draft_item    (AI suggestions, unconfirmed)            │  │
│  │    access_zone   (denied/restricted polygons)             │  │
│  │    field_note    (notebook entries)                        │  │
│  │                                                           │  │
│  │  Functions (SQL):                                         │  │
│  │    incidents_near_corridor(corridor_id, buffer_km)        │  │
│  │    corridor_risk_score(corridor_id)                       │  │
│  │    affected_population_estimate(zone_id)                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| PostGIS over client-side spatial | Server-side `ST_DWithin` scales to 10K+ incidents without client overhead |
| Turf.js for client preview | Instant visual feedback before DB write (buffer preview, line animation) |
| Draft→Confirm workflow | Eliminates AI geocoding errors; user is the final authority on pin placement |
| Supabase Realtime | Multiple field coordinators see the same live map; no polling needed |
| Prisma + raw PostGIS | Prisma for CRUD, raw SQL for spatial queries (Prisma lacks native geo support) |

---

## 2. Database Schema

### 2.1 Enable PostGIS in Supabase

```sql
-- Run in Supabase SQL Editor FIRST
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Verify
SELECT PostGIS_Version();
-- Should return: "3.4 USE_GEOS=1 USE_PROJ=1 USE_STATS=1"
```

### 2.2 Prisma Schema

```prisma
// schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")
  extensions = [postgis]
}

// ════════════════════════════════════════════
// AUTH & ORGANIZATION
// ════════════════════════════════════════════

model User {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email       String    @unique
  name        String?
  role        UserRole  @default(ANALYST)
  avatarUrl   String?   @map("avatar_url")
  createdAt   DateTime  @default(now()) @map("created_at")

  workspaces  WorkspaceMember[]
  drafts      DraftItem[]
  notes       FieldNote[]
  incidents   Incident[]   @relation("createdBy")
  corridors   Corridor[]   @relation("createdBy")

  @@map("users")
}

enum UserRole {
  ADMIN
  COORDINATOR
  ANALYST
  VIEWER
}

model Workspace {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String
  slug        String    @unique
  createdAt   DateTime  @default(now()) @map("created_at")

  members     WorkspaceMember[]
  operations  Operation[]

  @@map("workspaces")
}

model WorkspaceMember {
  userId      String    @map("user_id") @db.Uuid
  workspaceId String    @map("workspace_id") @db.Uuid
  role        UserRole  @default(ANALYST)
  joinedAt    DateTime  @default(now()) @map("joined_at")

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@id([userId, workspaceId])
  @@map("workspace_members")
}

// ════════════════════════════════════════════
// OPERATIONS (formerly "Events")
// ════════════════════════════════════════════

model Operation {
  id          String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  workspaceId String          @map("workspace_id") @db.Uuid
  name        String
  type        OperationType   @default(CORRIDOR)
  status      OperationStatus @default(ACTIVE)
  severity    Severity        @default(MEDIUM)

  /// PostGIS: bounding box for this operation's area of interest
  /// Stored as raw geometry, queried via raw SQL
  /// Prisma doesn't natively handle geometry — we use Unsupported type
  regionCenter  Unsupported("geometry(Point, 4326)")?
  regionBounds  Unsupported("geometry(Polygon, 4326)")?
  defaultZoom   Int             @default(6) @map("default_zoom")

  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  workspace   Workspace   @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  corridors   Corridor[]
  incidents   Incident[]
  briefs      Brief[]
  draftItems  DraftItem[]
  accessZones AccessZone[]
  notes       FieldNote[]

  @@index([workspaceId])
  @@map("operations")
}

enum OperationType {
  CORRIDOR
  CRISIS
  DISPLACEMENT
  HEALTH
  NATURAL_DISASTER
  CUSTOM
}

enum OperationStatus {
  PLANNING
  ACTIVE
  MONITORING
  CLOSED
  ARCHIVED
}

enum Severity {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

// ════════════════════════════════════════════
// CORRIDORS (Routes as LineStrings)
// ════════════════════════════════════════════

model Corridor {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  operationId   String    @map("operation_id") @db.Uuid
  name          String
  description   String?

  /// PostGIS LineString: the actual route geometry
  /// e.g. ST_GeomFromGeoJSON('{"type":"LineString","coordinates":[[32.5,15.5],[31.58,4.85]]}')
  route         Unsupported("geometry(LineString, 4326)")

  status        CorridorStatus @default(PARTIALLY_OPEN)
  riskScore     Float?         @map("risk_score")  // 0.0 - 1.0, computed
  lengthKm      Float?         @map("length_km")   // computed via ST_Length
  createdById   String?        @map("created_by_id") @db.Uuid
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")

  operation     Operation   @relation(fields: [operationId], references: [id], onDelete: Cascade)
  createdBy     User?       @relation("createdBy", fields: [createdById], references: [id])
  waypoints     Waypoint[]

  @@index([operationId])
  @@map("corridors")
}

enum CorridorStatus {
  OPEN
  PARTIALLY_OPEN
  RESTRICTED
  CLOSED
}

model Waypoint {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  corridorId  String    @map("corridor_id") @db.Uuid
  name        String
  description String?
  type        WaypointType @default(WAYPOINT)
  sortOrder   Int         @default(0) @map("sort_order")

  /// PostGIS Point
  location    Unsupported("geometry(Point, 4326)")

  corridor    Corridor  @relation(fields: [corridorId], references: [id], onDelete: Cascade)

  @@index([corridorId])
  @@map("waypoints")
}

enum WaypointType {
  ORIGIN
  DESTINATION
  WAYPOINT
  BASE
  CHECKPOINT
  RISK_ZONE
}

// ════════════════════════════════════════════
// INCIDENTS (Points or Polygons)
// ════════════════════════════════════════════

model Incident {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  operationId   String    @map("operation_id") @db.Uuid
  title         String
  description   String?
  type          IncidentType
  severity      Severity     @default(MEDIUM)
  date          DateTime     @default(now())

  /// PostGIS: Point for single incidents, Polygon for area-wide events
  location      Unsupported("geometry(Geometry, 4326)")

  /// Derived: nearest corridor ID (auto-computed by trigger)
  nearestCorridorId String?  @map("nearest_corridor_id") @db.Uuid
  distanceToCorridorKm Float? @map("distance_to_corridor_km")

  actor         String?      // Who caused it (e.g. "SSPDF")
  organization  String?      // Who reported it (e.g. "MSF Holland")
  source        IncidentSource @default(MANUAL)
  verified      Boolean      @default(false)
  createdById   String?      @map("created_by_id") @db.Uuid
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")

  operation     Operation    @relation(fields: [operationId], references: [id], onDelete: Cascade)
  createdBy     User?        @relation("createdBy", fields: [createdById], references: [id])

  @@index([operationId])
  @@index([severity])
  @@index([type])
  @@map("incidents")
}

enum IncidentType {
  BOMBARDMENT
  LOOTING
  ACCESS_DENIAL
  CONTROL_CHANGE
  HEALTH
  DISPLACEMENT
  FLOOD
  EARTHQUAKE
}

enum IncidentSource {
  MANUAL          // User placed directly
  AI_CONFIRMED    // AI suggested, user confirmed
  FIELD_REPORT    // From field team
  EXTERNAL_FEED   // From external API/RSS
}

// ════════════════════════════════════════════
// BRIEFS & AI DRAFT WORKFLOW
// ════════════════════════════════════════════

model Brief {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  operationId   String    @map("operation_id") @db.Uuid
  text          String
  source        String?   // "OCHA SitRep", "MSF Flash", "Field Radio"
  aiModel       String?   @map("ai_model")     // "claude-opus-4-6", "gpt-5"
  aiProvider    String?   @map("ai_provider")   // "anthropic", "openai"
  parsedAt      DateTime? @map("parsed_at")
  archived      Boolean   @default(false)
  createdAt     DateTime  @default(now()) @map("created_at")

  operation     Operation   @relation(fields: [operationId], references: [id], onDelete: Cascade)
  draftItems    DraftItem[]

  @@index([operationId])
  @@map("briefs")
}

/// AI suggestions awaiting user confirmation
model DraftItem {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  briefId         String    @map("brief_id") @db.Uuid
  operationId     String    @map("operation_id") @db.Uuid

  /// What the AI extracted
  suggestedTitle  String    @map("suggested_title")
  suggestedDesc   String?   @map("suggested_desc")
  suggestedType   IncidentType @map("suggested_type")
  suggestedSeverity Severity @map("suggested_severity")
  suggestedDate   DateTime? @map("suggested_date")
  suggestedActor  String?   @map("suggested_actor")
  suggestedOrg    String?   @map("suggested_org")

  /// PostGIS Point: AI's best guess at location
  suggestedLocation Unsupported("geometry(Point, 4326)") @map("suggested_location")

  /// Confidence metadata
  locationSource  String?   @map("location_source")  // "GEO_DICT", "Nominatim", "AI_estimate"
  uncertaintyFlag Boolean   @default(false) @map("uncertainty_flag")
  uncertaintyNote String?   @map("uncertainty_note")  // "Vague reference: 'southern region'"

  /// User action
  status          DraftStatus @default(PENDING)
  reviewedById    String?     @map("reviewed_by_id") @db.Uuid

  /// If confirmed: the user's corrected location (may differ from suggested)
  confirmedLocation Unsupported("geometry(Point, 4326)")? @map("confirmed_location")
  confirmedIncidentId String? @map("confirmed_incident_id") @db.Uuid

  createdAt       DateTime  @default(now()) @map("created_at")

  brief           Brief     @relation(fields: [briefId], references: [id], onDelete: Cascade)
  operation       Operation @relation(fields: [operationId], references: [id], onDelete: Cascade)
  reviewedBy      User?     @relation(fields: [reviewedById], references: [id])

  @@index([operationId, status])
  @@index([briefId])
  @@map("draft_items")
}

enum DraftStatus {
  PENDING     // Awaiting review
  CONFIRMED   // User verified & saved as incident
  REJECTED    // User dismissed
  MERGED      // Combined with existing incident
}

// ════════════════════════════════════════════
// ACCESS ZONES & FIELD NOTES
// ════════════════════════════════════════════

model AccessZone {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  operationId   String    @map("operation_id") @db.Uuid
  name          String
  type          AccessType
  description   String?

  /// PostGIS: Polygon or Circle (stored as Polygon via ST_Buffer)
  zone          Unsupported("geometry(Polygon, 4326)")

  validFrom     DateTime? @map("valid_from")
  validTo       DateTime? @map("valid_to")
  createdAt     DateTime  @default(now()) @map("created_at")

  operation     Operation @relation(fields: [operationId], references: [id], onDelete: Cascade)

  @@index([operationId])
  @@map("access_zones")
}

enum AccessType {
  DENIED
  RESTRICTED
  ESCORT_REQUIRED
  TIME_LIMITED
}

model FieldNote {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  operationId   String    @map("operation_id") @db.Uuid
  authorId      String?   @map("author_id") @db.Uuid
  text          String
  type          NoteType  @default(NOTE)

  /// Optional: geo-tag a note to a location
  location      Unsupported("geometry(Point, 4326)")?

  createdAt     DateTime  @default(now()) @map("created_at")

  operation     Operation @relation(fields: [operationId], references: [id], onDelete: Cascade)
  author        User?     @relation(fields: [authorId], references: [id])

  @@index([operationId])
  @@map("field_notes")
}

enum NoteType {
  NOTE
  ALERT
  SITREP
  DECISION
}
```

### 2.3 PostGIS Spatial Functions (Raw SQL via Supabase)

```sql
-- ═══════════════════════════════════════════════════════════
-- FUNCTION: Find all incidents within N km of a corridor
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION incidents_near_corridor(
  p_corridor_id UUID,
  p_buffer_km FLOAT DEFAULT 10.0
)
RETURNS TABLE (
  incident_id UUID,
  title TEXT,
  severity TEXT,
  type TEXT,
  distance_km FLOAT,
  location_json JSONB
)
LANGUAGE sql STABLE
AS $$
  SELECT
    i.id,
    i.title,
    i.severity::TEXT,
    i.type::TEXT,
    ROUND(
      (ST_Distance(i.location::geography, c.route::geography) / 1000.0)::NUMERIC, 2
    )::FLOAT AS distance_km,
    ST_AsGeoJSON(i.location)::JSONB
  FROM incidents i
  JOIN corridors c ON c.id = p_corridor_id
  WHERE i.operation_id = c.operation_id
    AND ST_DWithin(
      i.location::geography,
      c.route::geography,
      p_buffer_km * 1000  -- ST_DWithin uses meters
    )
  ORDER BY distance_km ASC;
$$;

-- ═══════════════════════════════════════════════════════════
-- FUNCTION: Compute corridor risk score (0.0 - 1.0)
-- Based on: incident count, severity weights, access zones
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION corridor_risk_score(
  p_corridor_id UUID,
  p_buffer_km FLOAT DEFAULT 15.0
)
RETURNS FLOAT
LANGUAGE sql STABLE
AS $$
  SELECT LEAST(1.0,
    COALESCE(SUM(
      CASE i.severity
        WHEN 'CRITICAL' THEN 0.25
        WHEN 'HIGH'     THEN 0.15
        WHEN 'MEDIUM'   THEN 0.08
        WHEN 'LOW'      THEN 0.03
      END
    ), 0.0)
  )::FLOAT
  FROM incidents i
  JOIN corridors c ON c.id = p_corridor_id
  WHERE i.operation_id = c.operation_id
    AND ST_DWithin(
      i.location::geography,
      c.route::geography,
      p_buffer_km * 1000
    );
$$;

-- ═══════════════════════════════════════════════════════════
-- FUNCTION: Auto-compute corridor length on insert/update
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_corridor_length()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.length_km := ROUND(
    (ST_Length(NEW.route::geography) / 1000.0)::NUMERIC, 1
  )::FLOAT;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_corridor_length
  BEFORE INSERT OR UPDATE OF route ON corridors
  FOR EACH ROW EXECUTE FUNCTION update_corridor_length();

-- ═══════════════════════════════════════════════════════════
-- FUNCTION: Auto-link incident to nearest corridor
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION link_incident_to_corridor()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_corridor_id UUID;
  v_distance_km FLOAT;
BEGIN
  SELECT c.id,
         ROUND((ST_Distance(NEW.location::geography, c.route::geography) / 1000.0)::NUMERIC, 2)::FLOAT
  INTO v_corridor_id, v_distance_km
  FROM corridors c
  WHERE c.operation_id = NEW.operation_id
  ORDER BY ST_Distance(NEW.location::geography, c.route::geography) ASC
  LIMIT 1;

  IF v_distance_km IS NOT NULL AND v_distance_km <= 50.0 THEN
    NEW.nearest_corridor_id := v_corridor_id;
    NEW.distance_to_corridor_km := v_distance_km;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_incident_corridor_link
  BEFORE INSERT OR UPDATE OF location ON incidents
  FOR EACH ROW EXECUTE FUNCTION link_incident_to_corridor();

-- ═══════════════════════════════════════════════════════════
-- SPATIAL INDEX (critical for performance)
-- ═══════════════════════════════════════════════════════════
CREATE INDEX idx_incidents_location ON incidents USING GIST (location);
CREATE INDEX idx_corridors_route ON corridors USING GIST (route);
CREATE INDEX idx_access_zones_zone ON access_zones USING GIST (zone);
CREATE INDEX idx_draft_items_location ON draft_items USING GIST (suggested_location);
CREATE INDEX idx_waypoints_location ON waypoints USING GIST (location);
```

### 2.4 Data Model Mapping: V3 → V4

```
V3 (localStorage)              V4 (PostGIS)
──────────────────────────────────────────────────────
event                    →     operation
event.corridor[]         →     corridor (LineString) + waypoint[]
event.incidents[]        →     incident (Point/Polygon)
event.riskZones[]        →     access_zone (Polygon, type=RESTRICTED)
event.accessDenied[]     →     access_zone (Polygon, type=DENIED)
event.briefs[]           →     brief + draft_item[]
event.notebook[]         →     field_note
event.bases[]            →     waypoint (type=BASE)
event.drawings[]         →     access_zone or custom geometry
N/A                      →     draft_item (NEW: AI→Human workflow)
N/A                      →     workspace (NEW: team collaboration)
N/A                      →     user (NEW: auth + RLS)
```

---

## 3. AI System Prompt (Human-in-the-Loop)

This prompt is provider-agnostic. It works identically with Claude, GPT-5, Gemini, DeepSeek, and Grok because it forces strict JSON output.

```javascript
export const BRIEF_ANALYSIS_PROMPT_V4 = `You are a Humanitarian Crisis GIS Analyst.

TASK: Parse the following humanitarian brief and extract ALL discrete incidents, 
access constraints, and geographic events. Return structured JSON.

RULES:
1. Each item MUST have a real-world geographic location.
2. If you know the EXACT coordinates, set "uncertainty": false.
3. If the location is VAGUE (e.g. "southern region", "along the route", 
   "several localities"), set "uncertainty": true AND fill "uncertainty_note" 
   explaining why.
4. NEVER invent coordinates. If you cannot determine even an approximate location, 
   set lat/lng to null and "uncertainty": true.
5. Use the CONTEXT REGION below to bias your coordinate estimates.
6. Return ONLY the JSON array — no markdown, no explanation.

CONTEXT REGION (bias your estimates here):
Center: {centerLat}, {centerLng}
Bounds: [{southLat}, {westLng}] to [{northLat}, {eastLng}]
Country/Area: {areaName}

OUTPUT SCHEMA (JSON array):
[
  {
    "title": "Short descriptive title (max 80 chars)",
    "description": "1-2 sentence summary from the text",
    "type": "BOMBARDMENT|LOOTING|ACCESS_DENIAL|CONTROL_CHANGE|HEALTH|DISPLACEMENT|FLOOD|EARTHQUAKE",
    "severity": "CRITICAL|HIGH|MEDIUM|LOW",
    "date": "YYYY-MM-DD or null if unknown",
    "lat": 12.345 or null,
    "lng": 34.567 or null,
    "location_name": "The place name as written in the text",
    "actor": "Who caused it, or null",
    "organization": "Who reported/responded, or null",
    "uncertainty": true/false,
    "uncertainty_note": "Explain why location is uncertain, or null"
  }
]

BRIEF TEXT:
`;
```

### 3.1 Why This Prompt Works

| Feature | Purpose |
|---------|---------|
| `uncertainty` flag | Frontend shows ⚠️ icon on draft items; user knows to double-check |
| `lat/lng: null` allowed | Prevents AI from hallucinating coordinates; item goes to "Needs Location" queue |
| Context region | Constrains AI's coordinate estimates to the operation area (replaces Nominatim bias) |
| Provider-agnostic | No Anthropic-specific features; plain JSON instruction works on all LLMs |
| `location_name` field | Preserved for user reference; shown in draft sidebar next to suggested pin |

### 3.2 Prompt Builder Function

```javascript
export function buildAnalysisPrompt(operation, briefText) {
  const region = operation.regionBounds || operation.regionCenter;
  let context = 'Unknown';
  
  if (region?.bounds) {
    const [[s, w], [n, e]] = region.bounds;
    context = BRIEF_ANALYSIS_PROMPT_V4
      .replace('{centerLat}', ((s + n) / 2).toFixed(2))
      .replace('{centerLng}', ((w + e) / 2).toFixed(2))
      .replace('{southLat}', s.toFixed(2))
      .replace('{westLng}', w.toFixed(2))
      .replace('{northLat}', n.toFixed(2))
      .replace('{eastLng}', e.toFixed(2))
      .replace('{areaName}', operation.name);
  }
  
  return context + briefText;
}
```

---

## 4. Frontend Hooks

### 4.1 `useCorridorManager` — Spatial Query + Buffer Visualization

```javascript
// hooks/useCorridorManager.js
import { useState, useEffect, useMemo, useCallback } from 'react';
import * as turf from '@turf/turf';
import { supabase } from '../lib/supabase';

/**
 * Manages a corridor's spatial context:
 * - Fetches route geometry
 * - Computes Turf.js buffer polygon (client-side preview)
 * - Queries incidents within buffer (PostGIS server-side)
 * - Subscribes to realtime incident changes
 */
export function useCorridorManager(corridorId, bufferKm = 10) {
  const [corridor, setCorridor] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  const [nearbyIncidents, setNearbyIncidents] = useState([]);
  const [riskScore, setRiskScore] = useState(0);
  const [loading, setLoading] = useState(true);

  // ─── Fetch corridor + waypoints ────────────────────────
  useEffect(() => {
    if (!corridorId) return;
    
    async function fetchCorridor() {
      setLoading(true);
      
      // Fetch corridor with route as GeoJSON
      const { data: corr, error } = await supabase
        .rpc('get_corridor_geojson', { p_corridor_id: corridorId });
      
      if (corr) {
        setCorridor(corr);
      }
      
      // Fetch waypoints
      const { data: wps } = await supabase
        .from('waypoints')
        .select('*')
        .eq('corridor_id', corridorId)
        .order('sort_order');
      
      if (wps) setWaypoints(wps);
      setLoading(false);
    }
    
    fetchCorridor();
  }, [corridorId]);

  // ─── Client-side buffer (Turf.js) for instant preview ──
  const bufferPolygon = useMemo(() => {
    if (!corridor?.route_geojson) return null;
    
    try {
      const line = turf.lineString(
        JSON.parse(corridor.route_geojson).coordinates
      );
      return turf.buffer(line, bufferKm, { units: 'kilometers' });
    } catch (e) {
      console.warn('Buffer computation failed:', e);
      return null;
    }
  }, [corridor, bufferKm]);

  // ─── Server-side spatial query (PostGIS) ───────────────
  const fetchNearbyIncidents = useCallback(async () => {
    if (!corridorId) return;
    
    const { data, error } = await supabase
      .rpc('incidents_near_corridor', {
        p_corridor_id: corridorId,
        p_buffer_km: bufferKm
      });
    
    if (data) setNearbyIncidents(data);
    
    // Also fetch risk score
    const { data: score } = await supabase
      .rpc('corridor_risk_score', {
        p_corridor_id: corridorId,
        p_buffer_km: bufferKm + 5 // slightly wider for risk
      });
    
    if (score !== null) setRiskScore(score);
  }, [corridorId, bufferKm]);

  useEffect(() => {
    fetchNearbyIncidents();
  }, [fetchNearbyIncidents]);

  // ─── Realtime: re-query when incidents change ──────────
  useEffect(() => {
    if (!corridor?.operation_id) return;
    
    const channel = supabase
      .channel(`incidents:${corridor.operation_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incidents',
          filter: `operation_id=eq.${corridor.operation_id}`
        },
        () => {
          // Re-run spatial query on any incident change
          fetchNearbyIncidents();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [corridor?.operation_id, fetchNearbyIncidents]);

  // ─── Client-side filter: check if a point is in buffer ─
  const isInBuffer = useCallback((lat, lng) => {
    if (!bufferPolygon) return false;
    return turf.booleanPointInPolygon(
      turf.point([lng, lat]),
      bufferPolygon
    );
  }, [bufferPolygon]);

  return {
    corridor,
    waypoints,
    nearbyIncidents,
    riskScore,
    bufferPolygon,   // GeoJSON polygon for Leaflet overlay
    isInBuffer,       // Quick check function
    loading,
    refetch: fetchNearbyIncidents
  };
}
```

### 4.2 `useDraftItems` — Human-in-the-Loop Workflow

```javascript
// hooks/useDraftItems.js
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Manages AI draft items: 
 * - Parse brief → create drafts
 * - Review (zoom to suggested location)
 * - Confirm (user-corrected position → save as incident)
 * - Reject (dismiss false positives)
 */
export function useDraftItems(operationId) {
  const [drafts, setDrafts] = useState([]);
  const [activeDraft, setActiveDraft] = useState(null);
  const [parsing, setParsing] = useState(false);

  // ─── Fetch pending drafts ──────────────────────────────
  const fetchDrafts = useCallback(async () => {
    const { data } = await supabase
      .from('draft_items')
      .select('*, brief:briefs(text, ai_model)')
      .eq('operation_id', operationId)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });
    
    if (data) setDrafts(data);
  }, [operationId]);

  // ─── Parse brief → create draft items ─────────────────
  const parseBrief = useCallback(async (briefId, briefText, callAI) => {
    setParsing(true);
    
    try {
      // Call AI (provider-agnostic via existing callAI)
      const rawResponse = await callAI(briefText);
      
      // Parse JSON from response
      const match = rawResponse.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('AI returned no JSON array');
      
      const items = JSON.parse(match[0]);
      
      // Insert draft items with PostGIS points
      for (const item of items) {
        if (item.lat === null || item.lng === null) {
          // No location — insert with a placeholder (operation center)
          // These go to a "Needs Location" queue
        }
        
        await supabase.rpc('insert_draft_item', {
          p_brief_id: briefId,
          p_operation_id: operationId,
          p_title: item.title,
          p_desc: item.description,
          p_type: item.type,
          p_severity: item.severity,
          p_date: item.date,
          p_actor: item.actor,
          p_org: item.organization,
          p_lat: item.lat,
          p_lng: item.lng,
          p_location_name: item.location_name,
          p_uncertainty: item.uncertainty || false,
          p_uncertainty_note: item.uncertainty_note
        });
      }
      
      await fetchDrafts();
      return items.length;
    } catch (e) {
      console.error('Parse failed:', e);
      throw e;
    } finally {
      setParsing(false);
    }
  }, [operationId, fetchDrafts]);

  // ─── Confirm draft → create real incident ──────────────
  const confirmDraft = useCallback(async (draftId, confirmedLat, confirmedLng) => {
    // Transaction: update draft status + insert incident
    const { data: incident, error } = await supabase
      .rpc('confirm_draft_item', {
        p_draft_id: draftId,
        p_confirmed_lat: confirmedLat,
        p_confirmed_lng: confirmedLng
      });
    
    if (error) throw error;
    
    // Remove from local state
    setDrafts(prev => prev.filter(d => d.id !== draftId));
    setActiveDraft(null);
    
    return incident;
  }, []);

  // ─── Reject draft ──────────────────────────────────────
  const rejectDraft = useCallback(async (draftId) => {
    await supabase
      .from('draft_items')
      .update({ status: 'REJECTED' })
      .eq('id', draftId);
    
    setDrafts(prev => prev.filter(d => d.id !== draftId));
    setActiveDraft(null);
  }, []);

  return {
    drafts,
    activeDraft,
    setActiveDraft,
    parsing,
    parseBrief,
    confirmDraft,
    rejectDraft,
    fetchDrafts
  };
}
```

### 4.3 Leaflet Integration: Animated Corridor + Buffer

```javascript
// components/CorridorLayer.jsx
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-ant-path';  // npm install leaflet-ant-path

export function CorridorLayer({ map, corridor, bufferPolygon, nearbyIncidents }) {
  const layerRef = useRef(L.layerGroup());

  useEffect(() => {
    if (!map || !corridor?.route_geojson) return;
    
    const group = layerRef.current;
    group.clearLayers();
    
    const routeCoords = JSON.parse(corridor.route_geojson)
      .coordinates.map(([lng, lat]) => [lat, lng]); // GeoJSON → Leaflet
    
    // ── Animated ant-path corridor ─────────────────────
    const antPath = L.polyline.antPath(routeCoords, {
      delay: 1500,
      dashArray: [20, 40],
      weight: 4,
      color: corridor.status === 'CLOSED' ? '#E8553A' :
             corridor.status === 'RESTRICTED' ? '#E89B2A' :
             corridor.status === 'PARTIALLY_OPEN' ? '#C9A84C' : '#5AAE7A',
      pulseColor: '#FFFFFF',
      paused: false,
      reverse: false,
      hardwareAccelerated: true
    });
    antPath.addTo(group);
    
    // ── Buffer zone (semi-transparent polygon) ─────────
    if (bufferPolygon) {
      const bufferLayer = L.geoJSON(bufferPolygon, {
        style: {
          fillColor: '#C9A84C',
          fillOpacity: 0.06,
          color: '#C9A84C',
          weight: 1,
          dashArray: '6 3',
          opacity: 0.4
        }
      });
      bufferLayer.addTo(group);
    }
    
    // ── Incidents within buffer (highlighted) ──────────
    nearbyIncidents?.forEach(inc => {
      const loc = JSON.parse(inc.location_json);
      const [lng, lat] = loc.coordinates;
      
      L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: inc.severity === 'CRITICAL' ? '#E8553A' :
                   inc.severity === 'HIGH' ? '#E89B2A' : '#C9A84C',
        color: '#FFF',
        weight: 2,
        fillOpacity: 0.9
      })
      .bindPopup(`<b>${inc.title}</b><br>${inc.distance_km} km from corridor`)
      .addTo(group);
    });
    
    group.addTo(map);
    
    return () => {
      group.clearLayers();
      map.removeLayer(group);
    };
  }, [map, corridor, bufferPolygon, nearbyIncidents]);

  return null;
}
```

---

## 5. Migration Plan

### Phase 0: Preparation (Week 1)

```
Current State:
  localStorage → events[] → renderEventToMap()

Step 0.1: Set up Supabase project
  - Create project at supabase.com
  - Enable PostGIS extension
  - Run schema SQL (from section 2.3)
  - Push Prisma schema: npx prisma db push

Step 0.2: Install dependencies
  npm install @supabase/supabase-js @turf/turf leaflet-ant-path leaflet-draw
  npm install -D prisma @prisma/client

Step 0.3: Environment setup
  .env.local:
    VITE_SUPABASE_URL=https://your-project.supabase.co
    VITE_SUPABASE_ANON_KEY=eyJ...
    DATABASE_URL=postgresql://...
    DIRECT_URL=postgresql://...  (for Prisma)
```

### Phase 1: Dual-Write (Week 2-3)

The safest migration path: keep localStorage working, add Supabase writes alongside.

```
┌─────────────────────────────────────────────────┐
│           Phase 1: DUAL WRITE MODE              │
│                                                 │
│  User Action                                    │
│       │                                         │
│       ├──→ localStorage (existing, unchanged)   │
│       │                                         │
│       └──→ Supabase (new, async, non-blocking)  │
│            - If Supabase fails → silent fallback│
│            - No user-facing changes yet         │
└─────────────────────────────────────────────────┘
```

```javascript
// lib/supabase.js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Wrapper: write to both localStorage and Supabase
export async function syncOperation(localEvent) {
  // localStorage write (existing — keep as-is)
  // ... existing ss() calls ...
  
  // Supabase write (new — non-blocking)
  try {
    await supabase.from('operations').upsert({
      id: localEvent.id,
      name: localEvent.name,
      type: localEvent.type.toUpperCase(),
      severity: localEvent.severity.toUpperCase(),
      status: localEvent.status?.toUpperCase() || 'ACTIVE',
    });
    
    // Sync incidents
    for (const inc of localEvent.incidents || []) {
      await supabase.rpc('upsert_incident_with_point', {
        p_id: inc.id,
        p_operation_id: localEvent.id,
        p_title: inc.ti,
        p_description: inc.d,
        p_type: inc.tp.toUpperCase().replace('-', '_'),
        p_severity: inc.s.toUpperCase(),
        p_lat: inc.a,
        p_lng: inc.o,
        p_date: inc.dt,
        p_actor: inc.ac,
        p_org: inc.og,
      });
    }
  } catch (e) {
    console.warn('Supabase sync failed (non-blocking):', e);
  }
}
```

### Phase 2: Read from Supabase (Week 4-5)

Switch reads to Supabase, keep localStorage as offline cache.

```
┌─────────────────────────────────────────────────┐
│           Phase 2: SUPABASE PRIMARY             │
│                                                 │
│  App Load:                                      │
│    1. Check Supabase connection                 │
│       ├── Online  → Fetch from Supabase         │
│       └── Offline → Fallback to localStorage    │
│                                                 │
│  User Action:                                   │
│    1. Write to Supabase (primary)               │
│    2. Update localStorage (offline cache)       │
│    3. Supabase Realtime → update other clients  │
└─────────────────────────────────────────────────┘
```

### Phase 3: Draft Workflow (Week 6-7)

Replace auto-pin with Human-in-the-Loop:

```
┌─────────────────────────────────────────────────┐
│           Phase 3: DRAFT WORKFLOW               │
│                                                 │
│  Brief Pasted                                   │
│       │                                         │
│       ▼                                         │
│  AI Parse (callAI — any provider)               │
│       │                                         │
│       ▼                                         │
│  Draft Items Created (Supabase)                 │
│       │                                         │
│       ▼                                         │
│  ┌─────────────────────────────────────────┐    │
│  │  DRAFT SIDEBAR                          │    │
│  │                                         │    │
│  │  ⚠️ Siirt Earthquake [UNCERTAIN]        │    │
│  │     AI suggests: 37.93, 42.01           │    │
│  │     "struck Siirt Province"             │    │
│  │     [Zoom] [Confirm ✓] [Reject ✗]      │    │
│  │                                         │    │
│  │  ✓ Displacement near Van                │    │
│  │     AI suggests: 38.49, 43.38           │    │
│  │     [Zoom] [Confirm ✓] [Reject ✗]      │    │
│  │                                         │    │
│  │  ⚠️ Road damage [NO LOCATION]           │    │
│  │     "secondary roads along corridor"    │    │
│  │     [Place on Map 📍] [Reject ✗]        │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  User clicks "Confirm ✓":                       │
│    → Pin appears on map (draggable)             │
│    → User drags to exact position               │
│    → Click "Save" → incident saved to DB        │
│    → Realtime: all connected clients see it     │
└─────────────────────────────────────────────────┘
```

### Phase 4: Spatial Intelligence (Week 8)

```
┌─────────────────────────────────────────────────┐
│           Phase 4: SPATIAL AWARENESS            │
│                                                 │
│  Corridor Drawn/Loaded                          │
│       │                                         │
│       ▼                                         │
│  PostGIS: ST_DWithin(incident, corridor, 10km)  │
│       │                                         │
│       ▼                                         │
│  ┌─────────────────────────────────────────┐    │
│  │  MAP VIEW                               │    │
│  │                                         │    │
│  │  ╔═══ animated ant-path corridor ═══╗   │    │
│  │  ║                                  ║   │    │
│  │  ║    [buffer zone: 10km band]      ║   │    │
│  │  ║         🔴 incident (2km)        ║   │    │
│  │  ║              🟡 incident (8km)   ║   │    │
│  │  ║                                  ║   │    │
│  │  ╚══════════════════════════════════╝   │    │
│  │                                         │    │
│  │  🟢 incident (15km) ← outside buffer    │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  Risk Score: corridor_risk_score() → 0.68       │
│  → Visual: corridor turns orange (HIGH)         │
└─────────────────────────────────────────────────┘
```

### Phase 5: Cleanup (Week 9-10)

- Remove localStorage dependency for primary data
- Keep localStorage only for: theme, font size, UI preferences
- Add offline-first with service worker + IndexedDB
- Row Level Security (RLS) policies in Supabase
- Deploy to Vercel with Edge Functions

---

## 6. Supabase Setup Checklist

```bash
# 1. Create Supabase project
# → https://supabase.com/dashboard → New Project

# 2. Enable PostGIS
# → SQL Editor → Run:
CREATE EXTENSION IF NOT EXISTS postgis;

# 3. Push Prisma schema
npx prisma db push

# 4. Run spatial functions SQL (section 2.3)
# → SQL Editor → paste all CREATE FUNCTION blocks

# 5. Enable Realtime on tables
# → Database → Replication → Enable for:
#    - incidents
#    - draft_items
#    - corridors
#    - field_notes

# 6. Row Level Security
# → Authentication → Policies → Enable RLS on all tables
# → Add policies per workspace membership

# 7. Environment variables
# .env.local:
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
DATABASE_URL=postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres
```

---

## File Summary

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | 12 models, PostGIS geometry, enums |
| `supabase/migrations/001_postgis_functions.sql` | 4 spatial functions + 2 triggers + 5 indexes |
| `src/hooks/useCorridorManager.js` | Buffer + spatial query + realtime |
| `src/hooks/useDraftItems.js` | AI→Draft→Confirm workflow |
| `src/components/CorridorLayer.jsx` | ant-path + buffer + incident viz |
| `src/lib/supabase.js` | Client init + dual-write helper |
