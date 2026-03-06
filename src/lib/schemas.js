import { z } from 'zod'

// ─── INCIDENT SCHEMA ───────────────────────────────────────────
export const IncidentSchema = z.object({
  id: z.string(),
  dt: z.string(), // YYYY-MM-DD
  a: z.number(),  // latitude
  o: z.number(),  // longitude
  tp: z.enum(['bombardment','looting','access-denial','control-change','health','displacement','flood','earthquake']),
  s: z.enum(['critical','high','medium','low']),
  ti: z.string().min(1),
  d: z.string().default(''),
  ac: z.string().default('Unknown'),
  og: z.string().default('Unknown'),
  uncertainty: z.boolean().optional(),
  uncertaintyNote: z.string().optional(),
})

// ─── WAYPOINT SCHEMA ───────────────────────────────────────────
export const WaypointSchema = z.object({
  n: z.string(),
  a: z.number(),
  o: z.number(),
  t: z.enum(['city','wp','base','rz']),
  d: z.string().default(''),
})

// ─── BRIEF SCHEMA ──────────────────────────────────────────────
export const BriefSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  ts: z.string(),
  archived: z.boolean().default(false),
})

// ─── RISK ZONE SCHEMA ──────────────────────────────────────────
export const RiskZoneSchema = z.object({
  n: z.string(),
  a: z.number(),
  o: z.number(),
  r: z.number(),
  s: z.enum(['critical','high','medium','low']),
  d: z.string().default(''),
})

// ─── ACCESS DENIED SCHEMA ──────────────────────────────────────
export const AccessDeniedSchema = z.object({
  n: z.string(),
  a: z.number(),
  o: z.number(),
  r: z.number(),
})

// ─── BASE SCHEMA ───────────────────────────────────────────────
export const BaseSchema = z.object({
  n: z.string(),
  a: z.number(),
  o: z.number(),
  st: z.string().default(''),
  c: z.string().default(''),
})

// ─── DRAWING SCHEMA ────────────────────────────────────────────
export const DrawingSchema = z.object({
  type: z.string(),
  a: z.number().optional(),
  o: z.number().optional(),
  r: z.number().optional(),
  color: z.string().optional(),
  label: z.string().optional(),
})

// ─── NOTEBOOK ENTRY SCHEMA ─────────────────────────────────────
export const NoteSchema = z.object({
  id: z.string(),
  author: z.string().default('User'),
  type: z.enum(['note','alert','sitrep','decision','update']).default('note'),
  text: z.string().min(1),
  ts: z.string(),
})

// ─── REGION SCHEMA ─────────────────────────────────────────────
export const RegionSchema = z.object({
  center: z.tuple([z.number(), z.number()]),
  zoom: z.number().default(6),
  bounds: z.tuple([
    z.tuple([z.number(), z.number()]),
    z.tuple([z.number(), z.number()]),
  ]).nullable().optional(),
})

// ─── FULL EVENT SCHEMA ─────────────────────────────────────────
export const EventSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.enum(['corridor','crisis','displacement','health','natural','custom']).default('corridor'),
  status: z.enum(['active','monitoring','closed','archived']).default('active'),
  severity: z.enum(['critical','high','medium','low']).default('medium'),
  brief: z.string().default(''),
  briefs: z.array(BriefSchema).default([]),
  region: RegionSchema.default({ center: [20, 0], zoom: 2, bounds: null }),
  corridor: z.array(WaypointSchema).default([]),
  incidents: z.array(IncidentSchema).default([]),
  riskZones: z.array(RiskZoneSchema).default([]),
  accessDenied: z.array(AccessDeniedSchema).default([]),
  bases: z.array(BaseSchema).default([]),
  drawings: z.array(DrawingSchema).default([]),
  notebook: z.array(NoteSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
})

// ─── AI PROVIDER SCHEMA ────────────────────────────────────────
export const AiProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  key: z.string().default(''),
  models: z.array(z.string()),
  active: z.boolean().default(false),
})

// ─── APP SETTINGS SCHEMA ───────────────────────────────────────
export const AppSettingsSchema = z.object({
  theme: z.enum(['dark','light']).default('dark'),
  lang: z.enum(['en','tr','fr','ar']).default('en'),
  fontSize: z.number().min(10).max(20).default(13),
  panelOpen: z.boolean().default(true),
  mapAnims: z.boolean().default(true),
  baseLayerId: z.string().default('darklabel'),
})

// ─── VALIDATION HELPERS ────────────────────────────────────────

/** Safe-parse an event, returning cleaned data or null on failure */
export function validateEvent(data) {
  const result = EventSchema.safeParse(data)
  if (result.success) return result.data
  console.warn('[Zod] Event validation failed:', result.error.issues)
  return null
}

/** Safe-parse an incident */
export function validateIncident(data) {
  const result = IncidentSchema.safeParse(data)
  if (result.success) return result.data
  console.warn('[Zod] Incident validation failed:', result.error.issues)
  return null
}

/** Validate array of events from localStorage, filtering out corrupt ones */
export function validateEventsArray(arr) {
  if (!Array.isArray(arr)) return []
  return arr
    .map(e => EventSchema.safeParse(e))
    .filter(r => r.success)
    .map(r => r.data)
}

/** Validate AI provider config array */
export function validateProviders(arr) {
  if (!Array.isArray(arr)) return null
  const results = arr.map(p => AiProviderSchema.safeParse(p))
  if (results.every(r => r.success)) return results.map(r => r.data)
  return null
}

/** Validate app settings */
export function validateSettings(data) {
  const result = AppSettingsSchema.safeParse(data)
  return result.success ? result.data : null
}
