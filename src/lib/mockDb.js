/**
 * Mock Database Layer for Corridor Planner V4
 * 
 * Mimics Supabase interface using localStorage.
 * When Supabase is ready, swap imports — zero frontend changes.
 * 
 * Usage:
 *   import { db } from './mockDb'
 *   const incidents = await db.incidents.list(operationId)
 *   await db.drafts.confirm(draftId, { lat, lng })
 */

const LS_KEY = 'cp4_db'

function loadDb() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || { operations: [], corridors: [], waypoints: [], incidents: [], briefs: [], drafts: [], accessZones: [], notes: [] }
  } catch { return { operations: [], corridors: [], waypoints: [], incidents: [], briefs: [], drafts: [], accessZones: [], notes: [] } }
}

function saveDb(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data))
}

function uid() { return crypto.randomUUID ? crypto.randomUUID() : 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) }

// ═══════════════════════════════════════════════
// LISTENERS (mock Supabase Realtime)
// ═══════════════════════════════════════════════
const _listeners = {}

function emit(table, event, payload) {
  const key = table
  if (_listeners[key]) _listeners[key].forEach(fn => fn({ event, table, payload }))
}

export function subscribe(table, callback) {
  if (!_listeners[table]) _listeners[table] = []
  _listeners[table].push(callback)
  return () => { _listeners[table] = _listeners[table].filter(fn => fn !== callback) }
}

// ═══════════════════════════════════════════════
// OPERATIONS
// ═══════════════════════════════════════════════
export const operations = {
  list: async () => loadDb().operations,
  
  get: async (id) => loadDb().operations.find(o => o.id === id) || null,
  
  upsert: async (op) => {
    const db = loadDb()
    const idx = db.operations.findIndex(o => o.id === op.id)
    const now = new Date().toISOString()
    if (idx >= 0) {
      db.operations[idx] = { ...db.operations[idx], ...op, updatedAt: now }
    } else {
      db.operations.push({ id: uid(), createdAt: now, updatedAt: now, ...op })
    }
    saveDb(db)
    emit('operations', idx >= 0 ? 'UPDATE' : 'INSERT', op)
    return db.operations.find(o => o.id === op.id) || db.operations[db.operations.length - 1]
  },
  
  delete: async (id) => {
    const db = loadDb()
    db.operations = db.operations.filter(o => o.id !== id)
    // Cascade
    db.corridors = db.corridors.filter(c => c.operationId !== id)
    db.incidents = db.incidents.filter(i => i.operationId !== id)
    db.drafts = db.drafts.filter(d => d.operationId !== id)
    db.briefs = db.briefs.filter(b => b.operationId !== id)
    db.accessZones = db.accessZones.filter(z => z.operationId !== id)
    db.notes = db.notes.filter(n => n.operationId !== id)
    saveDb(db)
    emit('operations', 'DELETE', { id })
  }
}

// ═══════════════════════════════════════════════
// CORRIDORS
// ═══════════════════════════════════════════════
export const corridors = {
  list: async (operationId) => loadDb().corridors.filter(c => c.operationId === operationId),
  
  get: async (id) => loadDb().corridors.find(c => c.id === id) || null,
  
  upsert: async (corr) => {
    const db = loadDb()
    const idx = db.corridors.findIndex(c => c.id === corr.id)
    const now = new Date().toISOString()
    if (idx >= 0) {
      db.corridors[idx] = { ...db.corridors[idx], ...corr, updatedAt: now }
    } else {
      db.corridors.push({ id: uid(), createdAt: now, updatedAt: now, status: 'PARTIALLY_OPEN', ...corr })
    }
    saveDb(db)
    emit('corridors', idx >= 0 ? 'UPDATE' : 'INSERT', corr)
    return db.corridors.find(c => c.id === corr.id) || db.corridors[db.corridors.length - 1]
  },
  
  delete: async (id) => {
    const db = loadDb()
    db.corridors = db.corridors.filter(c => c.id !== id)
    db.waypoints = db.waypoints.filter(w => w.corridorId !== id)
    saveDb(db)
    emit('corridors', 'DELETE', { id })
  }
}

// ═══════════════════════════════════════════════
// INCIDENTS
// ═══════════════════════════════════════════════
export const incidents = {
  list: async (operationId) => loadDb().incidents.filter(i => i.operationId === operationId),
  
  get: async (id) => loadDb().incidents.find(i => i.id === id) || null,
  
  upsert: async (inc) => {
    const db = loadDb()
    const idx = db.incidents.findIndex(i => i.id === inc.id)
    const now = new Date().toISOString()
    if (idx >= 0) {
      db.incidents[idx] = { ...db.incidents[idx], ...inc, updatedAt: now }
    } else {
      db.incidents.push({ id: uid(), createdAt: now, updatedAt: now, verified: false, source: 'MANUAL', ...inc })
    }
    saveDb(db)
    emit('incidents', idx >= 0 ? 'UPDATE' : 'INSERT', inc)
    return db.incidents.find(i => i.id === inc.id) || db.incidents[db.incidents.length - 1]
  },
  
  delete: async (id) => {
    const db = loadDb()
    db.incidents = db.incidents.filter(i => i.id !== id)
    saveDb(db)
    emit('incidents', 'DELETE', { id })
  }
}

// ═══════════════════════════════════════════════
// DRAFT ITEMS (AI → Human-in-the-Loop)
// ═══════════════════════════════════════════════
export const drafts = {
  list: async (operationId, status = 'PENDING') => {
    return loadDb().drafts.filter(d => d.operationId === operationId && d.status === status)
  },
  
  listAll: async (operationId) => {
    return loadDb().drafts.filter(d => d.operationId === operationId)
  },
  
  create: async (draft) => {
    const db = loadDb()
    const item = {
      id: uid(),
      status: 'PENDING',
      uncertaintyFlag: false,
      createdAt: new Date().toISOString(),
      ...draft
    }
    db.drafts.push(item)
    saveDb(db)
    emit('drafts', 'INSERT', item)
    return item
  },
  
  /** Confirm draft → creates a real incident, marks draft as CONFIRMED */
  confirm: async (draftId, confirmedLat, confirmedLng) => {
    const db = loadDb()
    const draft = db.drafts.find(d => d.id === draftId)
    if (!draft) throw new Error('Draft not found: ' + draftId)
    
    // Create real incident from draft
    const incident = {
      id: uid(),
      operationId: draft.operationId,
      title: draft.suggestedTitle,
      description: draft.suggestedDesc,
      type: draft.suggestedType,
      severity: draft.suggestedSeverity,
      date: draft.suggestedDate || new Date().toISOString().slice(0, 10),
      lat: confirmedLat,
      lng: confirmedLng,
      actor: draft.suggestedActor,
      organization: draft.suggestedOrg,
      source: 'AI_CONFIRMED',
      verified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    db.incidents.push(incident)
    
    // Update draft status
    const dIdx = db.drafts.findIndex(d => d.id === draftId)
    db.drafts[dIdx] = {
      ...db.drafts[dIdx],
      status: 'CONFIRMED',
      confirmedLat,
      confirmedLng,
      confirmedIncidentId: incident.id
    }
    
    saveDb(db)
    emit('drafts', 'UPDATE', db.drafts[dIdx])
    emit('incidents', 'INSERT', incident)
    return incident
  },
  
  /** Reject draft */
  reject: async (draftId) => {
    const db = loadDb()
    const dIdx = db.drafts.findIndex(d => d.id === draftId)
    if (dIdx >= 0) {
      db.drafts[dIdx] = { ...db.drafts[dIdx], status: 'REJECTED' }
      saveDb(db)
      emit('drafts', 'UPDATE', db.drafts[dIdx])
    }
  },
  
  /** Batch create from AI parse results */
  createFromAiParse: async (operationId, briefId, aiItems) => {
    const db = loadDb()
    const created = []
    for (const item of aiItems) {
      const draft = {
        id: uid(),
        operationId,
        briefId,
        suggestedTitle: item.title || 'Untitled',
        suggestedDesc: item.description || '',
        suggestedType: (item.type || 'DISPLACEMENT').toUpperCase().replace('-', '_'),
        suggestedSeverity: (item.severity || 'MEDIUM').toUpperCase(),
        suggestedDate: item.date || null,
        suggestedLat: item.lat,
        suggestedLng: item.lng,
        suggestedActor: item.actor || null,
        suggestedOrg: item.organization || null,
        locationName: item.location_name || null,
        locationSource: item.location_source || 'AI_ESTIMATE',
        uncertaintyFlag: item.uncertainty || (item.lat === null),
        uncertaintyNote: item.uncertainty_note || (item.lat === null ? 'No coordinates provided by AI' : null),
        status: 'PENDING',
        createdAt: new Date().toISOString()
      }
      db.drafts.push(draft)
      created.push(draft)
    }
    saveDb(db)
    emit('drafts', 'BATCH_INSERT', created)
    return created
  }
}

// ═══════════════════════════════════════════════
// BRIEFS
// ═══════════════════════════════════════════════
export const briefs = {
  list: async (operationId) => loadDb().briefs.filter(b => b.operationId === operationId && !b.archived),
  
  create: async (brief) => {
    const db = loadDb()
    const item = { id: uid(), archived: false, createdAt: new Date().toISOString(), ...brief }
    db.briefs.push(item)
    saveDb(db)
    emit('briefs', 'INSERT', item)
    return item
  },

  archive: async (id) => {
    const db = loadDb()
    const idx = db.briefs.findIndex(b => b.id === id)
    if (idx >= 0) { db.briefs[idx].archived = true; saveDb(db) }
  }
}

// ═══════════════════════════════════════════════
// V3 → V4 MIGRATION HELPER
// ═══════════════════════════════════════════════
/**
 * Import a V3 localStorage event into V4 mockDb format.
 * Call once during migration.
 */
export async function importV3Event(v3Event) {
  // Create operation
  const op = await operations.upsert({
    id: v3Event.id,
    name: v3Event.name,
    type: (v3Event.type || 'corridor').toUpperCase(),
    status: 'ACTIVE',
    severity: (v3Event.severity || 'medium').toUpperCase(),
    regionCenter: v3Event.region?.center || [20, 0],
    regionBounds: v3Event.region?.bounds || null,
    defaultZoom: v3Event.region?.zoom || 6
  })
  
  // Create corridor from waypoints
  if (v3Event.corridor?.length) {
    const corr = await corridors.upsert({
      operationId: op.id,
      name: v3Event.name + ' Route',
      // Store as GeoJSON-ready coordinate array
      routeCoords: v3Event.corridor.map(p => [p.o, p.a]), // [lng, lat]
      waypointData: v3Event.corridor,
      status: 'PARTIALLY_OPEN'
    })
  }
  
  // Import incidents
  for (const inc of v3Event.incidents || []) {
    await incidents.upsert({
      operationId: op.id,
      title: inc.ti,
      description: inc.d,
      type: (inc.tp || 'displacement').toUpperCase().replace('-', '_'),
      severity: (inc.s || 'medium').toUpperCase(),
      date: inc.dt,
      lat: inc.a,
      lng: inc.o,
      actor: inc.ac,
      organization: inc.og,
      source: 'MANUAL',
      verified: true
    })
  }
  
  // Import briefs
  for (const b of v3Event.briefs || []) {
    await briefs.create({
      operationId: op.id,
      text: b.text,
      source: 'V3 Import'
    })
  }
  
  return op
}

// Bundle as single export
export const db = { operations, corridors, incidents, drafts, briefs, subscribe, importV3Event }
export default db
