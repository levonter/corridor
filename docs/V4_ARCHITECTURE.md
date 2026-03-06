# Corridor Planner V4: Architecture & Migration Plan

**Status:** Phase 1 Complete (Frontend State & Styling)  
**Stack:** React 18 + Vite + Leaflet 1.9 + Zustand + TanStack Query + Zod + Tailwind CSS v4  
**Target:** Supabase/PostGIS + PowerSync offline-first  
**Last Updated:** 2026-03-06

---

## Architectural Constraints (Non-Negotiable)

| # | Constraint | Rationale |
|---|-----------|-----------|
| 1 | **Absolute Offline-First** | Network is intermittent in crisis zones. All primary read/write hits local storage first. PowerSync (SQLite) handles async reconciliation with Supabase. |
| 2 | **PostGIS Native** | All backend geographical data uses `geography(POINT, 4326)` and `geography(LINESTRING, 4326)` with GiST indexes. |
| 3 | **Server-Side Spatial** | Heavy spatial queries (`ST_DWithin`, buffer, `<->` proximity sort) run on PostGIS when connected. Turf.js remains as offline fallback. |
| 4 | **Zustand for State** | No React Context for frequently updating state (map coords, incident selection). Atomic selectors only. |
| 5 | **RTL Native Styling** | Tailwind CSS v4 with CSS Logical Properties (`ms-`, `pe-`, `inset-inline-start-`). Physical direction classes (`left/right`, `ml-`, `pr-`) are **strictly forbidden** in new code. |
| 6 | **HITL Principle** | AI never writes directly to the live operational map. All AI extractions enter "Draft" state requiring human approval. Uncertain locations render as Ghost Nodes. |
| 7 | **Vitest + Playwright** | Unit tests mock Nominatim/fetch (`vi.mock()`). Canvas tests use Playwright coordinate-based click emulation + Visual Regression Testing (VRT). |

---

## Phase 1: Frontend State & Styling ✅ COMPLETE

**Objective:** Stabilize frontend performance for future backend sync.

### Completed
- [x] Zustand store (`useAppStore.js`, 365 lines) — replaces ~50 useState hooks
- [x] TanStack Query (`api.js`, 272 lines) — AI calls, geocoding cache, brief analysis mutation
- [x] Zod schemas (`schemas.js`, 172 lines) — Event, Incident, Brief, Waypoint validation
- [x] InteractiveMap component (`InteractiveMap.jsx`, 375 lines) — extracted Leaflet lifecycle
- [x] Auto-emoji detection (`autoDetectType()`) — keyword-based type+icon resolution
- [x] Tailwind CSS v4 config with crisis theme colors (navy/gold dark, parchment/brown light)
- [x] Vitest config + 20 test cases (geocoding, schemas, export roundtrip, auto-emoji)
- [x] QueryClientProvider wrapper in App root
- [x] Ghost Node rendering for uncertain AI locations (`_uncertainty` flag)
- [x] Husky pre-push hook (`npm run test:run && npm run build`)

### Pending
- [ ] Full Tailwind utility class migration (currently CSS variables + Tailwind hybrid)
- [ ] CSS Logical Properties for RTL (`ms-`, `pe-` instead of `ml-`, `pr-`)
- [ ] Remove remaining `style={{}}` inline objects → Tailwind classes

### File Structure (v4)
```
corridor-planner/
├── package.json                     # Deps: Zustand, TanStack Query, Zod, Tailwind, Vitest, Husky
├── tailwind.config.js               # Crisis theme: navy/gold + parchment/brown
├── vite.config.js                   # React + Tailwind v4 + Vitest config
├── .husky/
│   └── pre-push                     # npm run test:run && npm run build
├── src/
│   ├── App.jsx                      # Root — QueryClientProvider + layout (236 lines)
│   ├── main.jsx                     # Vite entry
│   ├── store/
│   │   └── useAppStore.js           # Zustand global store (365 lines)
│   ├── lib/
│   │   ├── api.js                   # TanStack Query + AI + geocoding (272 lines)
│   │   ├── schemas.js               # Zod validation schemas (172 lines)
│   │   └── mockDb.js                # V4 mock database layer (341 lines)
│   ├── components/
│   │   ├── Map/
│   │   │   └── InteractiveMap.jsx   # Leaflet map + draw + ghost nodes (375 lines)
│   │   └── SharedView.jsx           # Public read-only view (123 lines)
│   ├── hooks/
│   │   ├── useMapDraw.jsx           # Leaflet.Draw + Turf.js (546 lines)
│   │   └── useCorridorSpatial.js    # Buffer/spatial analysis (212 lines)
│   ├── data/
│   │   ├── events.js                # Data models, rendering, geocoding (246 lines)
│   │   └── i18n.js                  # 4-language translations (64 lines)
│   ├── styles/
│   │   └── theme.css                # CSS variables + animations (44 lines — legacy, being replaced)
│   └── test/
│       ├── setup.js                 # Vitest setup + localStorage mock
│       └── geocoding.test.js        # 20+ unit tests
└── docs/
    └── V4_ARCHITECTURE.md           # This document
```

### Key Architectural Decisions

**Zustand Atomic Selectors:**
```javascript
// BAD — re-renders on ANY store change
const store = useAppStore()
// GOOD — only re-renders when specific field changes
const theme = useAppStore(s => s.theme)
const activeEventId = useAppStore(s => s.activeEventId)
```

**TanStack Query for Nominatim:**
```javascript
// Cache geocoding results — same city served instantly from cache
const cached = queryClient.getQueryData(['geocode', 'lankien', viewbox])
// Stale time: 1 hour (locations don't move)
// GC time: 24 hours
```

**Zod Graceful Degradation:**
```javascript
// Malformed localStorage doesn't crash — schema repairs what it can
function safeParseEvents(raw) {
  return raw.map(ev => { try { return EventSchema.parse(ev) } catch { return ev } })
}
```

**Ghost Nodes for AI Uncertainty:**
```javascript
// V4 AI prompt returns { uncertainty: true, uncertainty_note: "..." }
// InteractiveMap renders these as semi-transparent markers
if (incident._uncertainty) {
  L.circleMarker([lat, lng], {
    fillOpacity: 0.3,    // Ghost effect
    dashArray: '4 4',     // Dashed border
    className: 'ghost-node',
  })
}
// Sidebar shows uncertainty warning
{inc._uncertainty && <div>⚠️ Location uncertain: {inc._uncertaintyNote}</div>}
```

---

## Phase 2: Database Architecture (PostGIS)

**Objective:** Establish centralized truth database with spatial capabilities.

### Supabase Setup
1. Provision Supabase project
2. Enable PostGIS extension: `CREATE EXTENSION postgis;`
3. Deploy Prisma schema (below)
4. Create GiST indexes on all geography columns
5. Establish initial RLS policies by operational theater

### Prisma Schema

```prisma
model Operation {
  id        String   @id @default(cuid())
  name      String
  type      String   @default("corridor")
  status    String   @default("active")
  severity  String   @default("medium")
  region    Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  corridors  Corridor[]
  incidents  Incident[]
  briefs     Brief[]
  drafts     Draft[]
}

model Incident {
  id          String   @id @default(cuid())
  operationId String
  operation   Operation @relation(fields: [operationId], references: [id], onDelete: Cascade)
  title       String
  description String   @default("")
  type        String
  severity    String
  location    Unsupported("geography(POINT, 4326)")
  date        DateTime
  actor       String   @default("Unknown")
  org         String   @default("Unknown")
  isDraft     Boolean  @default(false)
  confidence  Float?
  createdAt   DateTime @default(now())

  @@index([operationId])
  @@index([location], type: Gist)
}

model Corridor {
  id          String   @id @default(cuid())
  operationId String
  operation   Operation @relation(fields: [operationId], references: [id], onDelete: Cascade)
  name        String
  path        Unsupported("geography(LINESTRING, 4326)")
  waypoints   Json     @default("[]")
  riskScore   Float?

  @@index([operationId])
  @@index([path], type: Gist)
}

model Draft {
  id          String   @id @default(cuid())
  operationId String
  operation   Operation @relation(fields: [operationId], references: [id], onDelete: Cascade)
  briefId     String?
  status      String   @default("PENDING") // PENDING | CONFIRMED | REJECTED | MERGED
  rawData     Json
  confirmedLat Float?
  confirmedLng Float?
  reviewedBy  String?
  createdAt   DateTime @default(now())

  @@index([operationId, status])
}

model Brief {
  id          String   @id @default(cuid())
  operationId String
  operation   Operation @relation(fields: [operationId], references: [id], onDelete: Cascade)
  text        String
  source      String?
  archived    Boolean  @default(false)
  createdAt   DateTime @default(now())

  @@index([operationId])
}
```

### PostGIS Functions

```sql
-- Find incidents within N km of a corridor
CREATE OR REPLACE FUNCTION incidents_near_corridor(
  p_corridor_id TEXT,
  p_buffer_km FLOAT DEFAULT 50
)
RETURNS SETOF "Incident" AS $$
  SELECT i.*
  FROM "Incident" i
  JOIN "Corridor" c ON c.id = p_corridor_id
  WHERE ST_DWithin(i.location, c.path, p_buffer_km * 1000)
  ORDER BY i.location <-> c.path  -- spatial proximity sort
$$ LANGUAGE sql STABLE;

-- Compute corridor risk score
CREATE OR REPLACE FUNCTION corridor_risk_score(p_corridor_id TEXT)
RETURNS FLOAT AS $$
  SELECT LEAST(1.0, COALESCE(SUM(
    CASE i.severity
      WHEN 'critical' THEN 0.25
      WHEN 'high' THEN 0.15
      WHEN 'medium' THEN 0.08
      WHEN 'low' THEN 0.03
    END
  ), 0))
  FROM incidents_near_corridor(p_corridor_id, 50) i
$$ LANGUAGE sql STABLE;

-- Auto-link new incidents to nearby corridors (trigger)
CREATE OR REPLACE FUNCTION link_incident_to_corridor()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "Corridor" SET "riskScore" = corridor_risk_score(id)
  WHERE ST_DWithin(path, NEW.location, 100000);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_link_incident
  AFTER INSERT ON "Incident"
  FOR EACH ROW EXECUTE FUNCTION link_incident_to_corridor();
```

---

## Phase 3: Spatial Logic Migration (Client → Server)

**Objective:** Offload heavy spatial computation from browser to PostgreSQL.

### Migration Matrix

| Operation | Current (Turf.js) | Target (PostGIS) | Offline Fallback |
|-----------|-------------------|-------------------|------------------|
| Buffer zone | `turf.buffer(line, 50, {units:'km'})` | `ST_Buffer(path, 50000)` | Turf.js |
| Point in buffer | `turf.booleanPointInPolygon()` | `ST_DWithin(point, path, 50000)` | Turf.js |
| Nearby incidents | JS `.filter()` loop | `incidents_near_corridor()` RPC | Turf.js |
| Risk score | `computeRiskScore()` in JS | `corridor_risk_score()` in SQL | JS fallback |
| Corridor length | `turf.length(line)` | `ST_Length(path)` | Turf.js |
| Proximity sort | `.sort()` by distance | `ORDER BY location <-> path` | JS `.sort()` |

### Hybrid `useCorridorSpatial.js` (Updated)
```javascript
export async function filterIncidentsInBuffer(incidents, waypoints, bufferKm) {
  // Try PostGIS first (if online + corridor exists in DB)
  if (navigator.onLine && corridorId) {
    try {
      const { data } = await supabase.rpc('incidents_near_corridor', {
        p_corridor_id: corridorId,
        p_buffer_km: bufferKm,
      })
      return data
    } catch (e) {
      console.warn('PostGIS fallback to Turf.js:', e)
    }
  }
  // Offline fallback: Turf.js (existing code)
  const T = await loadTurf()
  const line = T.lineString(waypoints.map(w => [w.o, w.a]))
  const buffer = T.buffer(line, bufferKm, { units: 'kilometers' })
  return incidents.filter(i => T.booleanPointInPolygon(T.point([i.o, i.a]), buffer))
}
```

---

## Phase 4: Offline Synchronization (PowerSync)

**Objective:** Guarantee absolute offline-first with local-first architecture.

### Architecture
```
┌─────────────────────────┐       ┌──────────────────────────┐
│   React App (Browser)    │       │   Supabase/PostGIS       │
│                          │       │                          │
│  ┌────────────────────┐  │       │  ┌────────────────────┐  │
│  │ PowerSync Client   │  │◄─────►│  │ WAL Replication    │  │
│  │ (SQLite in WASM)   │  │  sync │  │ (CDC via WAL)      │  │
│  └────────┬───────────┘  │       │  └────────────────────┘  │
│           │ read/write   │       │                          │
│  ┌────────▼───────────┐  │       │  ┌────────────────────┐  │
│  │ Zustand Store      │  │       │  │ Row Level Security │  │
│  │ (UI Read Layer)    │  │       │  │ (Per Operation)    │  │
│  └────────────────────┘  │       │  └────────────────────┘  │
└─────────────────────────┘       └──────────────────────────┘
```

### Integration Steps
1. Install PowerSync: `@powersync/web` (WASM SQLite)
2. Configure PowerSync to connect to Supabase PostgreSQL WAL
3. Define sync rules mirroring RLS (partial sync by operation region)
4. Replace direct `localStorage` reads with PowerSync SQLite queries
5. Zustand store reads from PowerSync (reactive)

### Conflict Resolution
- **Strategy:** Last-Write-Wins (LWW) for standard data (incidents, briefs, notes)
- **Exception:** Draft confirmations — server always wins (prevents double-approve)
- **Merge strategy for notebook:** Append-only (no conflicts possible)

### PowerSync Sync Rules
```yaml
bucket_definitions:
  by_operation:
    parameters: SELECT id FROM operations WHERE user_has_access(id)
    data:
      - SELECT * FROM incidents WHERE operation_id = bucket.id
      - SELECT * FROM corridors WHERE operation_id = bucket.id
      - SELECT * FROM briefs WHERE operation_id = bucket.id
      - SELECT * FROM drafts WHERE operation_id = bucket.id AND status = 'PENDING'
```

---

## Phase 5: Human-In-The-Loop (HITL) Validation

**Objective:** Mitigate AI hallucination in spatial data.

### Draft Lifecycle
```
AI Parse Brief
    │
    ▼
┌──────────┐    ┌────────────┐    ┌────────────┐
│  PENDING  │───►│  CONFIRMED  │───►│  Published  │
│  (Draft)  │    │  (Reviewed) │    │  (Live Map) │
└─────┬─────┘    └────────────┘    └────────────┘
      │
      ▼
┌──────────┐
│ REJECTED  │
└──────────┘
```

### Ghost Nodes (Uncertainty Visualization)
When AI returns `uncertainty: true`, render marker as:
- `fillOpacity: 0.3` (semi-transparent)
- `dashArray: '4 4'` (dashed border)
- `className: 'ghost-node'` (CSS pulsing)
- Sidebar shows ⚠️ warning with `uncertainty_note`

### Split-Pane Review UI (Planned)
```
┌──────────────────────────┬──────────────────────────┐
│   Raw Sitrep Text         │   Interactive Map         │
│   (highlighted places)    │   (draft pins visible)    │
│                           │                           │
│   ████ Lankien ████       │      ◉ Lankien (draft)    │
│   ████ Walgak ████        │      ◎ Walgak (uncertain) │
│                           │                           │
│   [Confirm All]           │      [Click to correct]   │
│   [Reject Selected]      │      [Drag to reposition]  │
└──────────────────────────┴──────────────────────────┘
```

### Confidence-Based Exception Routing
- AI confidence ≥ 0.8 → Auto-populate form (still requires confirm click)
- AI confidence 0.5–0.8 → Show as Ghost Node, highlight for review
- AI confidence < 0.5 → Flag as "needs manual geocoding"

---

## Phase 6: Enterprise-Grade Quality Assurance

### Vitest Configuration ✅ Implemented
```javascript
// vite.config.js
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/test/setup.js',
  css: true,
}
```

### Test Coverage

| Module | Tests | Status |
|--------|-------|--------|
| `extractPlaces` | False positive prevention (waterborne, unity) | ✅ |
| `GEO_DICT` | Coordinate accuracy (Sudan, Turkey, Niger) | ✅ |
| `autoDetectType` | Emoji resolution + multi-tag | ✅ |
| `IncidentSchema` | Zod validation + rejection | ✅ |
| `EventSchema` | SUDAN_EVENT validation + defaults | ✅ |
| `renderEventToMap` | 6 layer groups structure | ✅ |
| `encodeShare/decodeShare` | Roundtrip integrity | ✅ |
| `eventToGeoJSON` | FeatureCollection structure | ✅ |
| `eventToCSV` | Header + row validation | ✅ |
| Playwright E2E | Brief paste → pin verification | ⬜ Phase 6 |
| Playwright VRT | Map visual regression | ⬜ Phase 6 |
| PowerSync sync | Offline → online reconciliation | ⬜ Phase 4 |

### Husky Pre-Push ✅ Configured
```bash
# .husky/pre-push
npm run test:run && npm run build
```

---

## Migration Timeline

| Phase | Week | Status | Deliverable |
|-------|------|--------|-------------|
| 1. Frontend State & Styling | 1-2 | ✅ COMPLETE | Zustand, TanStack Query, Zod, Tailwind, Vitest |
| 2. Database Architecture | 3-4 | ⬜ NEXT | Supabase, Prisma, PostGIS schema, GiST indexes |
| 3. Spatial Migration | 5-6 | ⬜ | ST_DWithin, server-side buffers, hybrid spatial hook |
| 4. Offline Sync | 7-8 | ⬜ | PowerSync, SQLite WASM, WAL replication, sync rules |
| 5. HITL UI | 9-10 | ⬜ | Draft workflow, split-pane review, ghost nodes in UI |
| 6. QA | 11-12 | 🟡 Unit done | Playwright E2E, VRT, integration tests |

---

## AI Execution Protocol

When executing phases of this migration, the AI must:

1. **Read this document first** — understand all 7 constraints before writing code
2. **Check existing code** — never overwrite working features
3. **Preserve offline capability** — localStorage + mock DB always functional
4. **Validate with Zod** — all data entering/leaving store passes schema
5. **Use atomic Zustand selectors** — no full-store subscriptions
6. **Test every change** — add Vitest cases for new logic
7. **Respect RTL** — CSS Logical Properties only in new code (`ms-` not `ml-`)
8. **HITL enforcement** — AI extractions → Draft state, never direct to live map
9. **PostGIS first** — when connected, spatial queries go to server, Turf.js is fallback only

**Phase execution command format:**
```
"Execute Phase X" → produce production-ready code for that phase only
```
