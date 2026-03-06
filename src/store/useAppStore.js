/**
 * useAppStore.js — Zustand Global Store for Corridor Planner v4
 * 
 * Replaces: ~50 useState hooks in App.jsx
 * Features:
 *   - localStorage persistence (offline-first)
 *   - Zod validation on load/save
 *   - Atomic updates (no prop drilling)
 *   - Auto-emoji type detection
 */
import { create } from 'zustand'
import { z } from 'zod'
import { SUDAN_EVENT, createEvent, ICON_MAP, EVENT_TYPES } from '../data/events.js'

// ─── Zod Schemas ───────────────────────────────────────────────

export const IncidentSchema = z.object({
  id: z.string(),
  dt: z.string(),
  a: z.number(),
  o: z.number(),
  tp: z.string(),
  s: z.enum(['critical', 'high', 'medium', 'low']),
  ti: z.string(),
  d: z.string().default(''),
  ac: z.string().default('Unknown'),
  og: z.string().default('Field'),
})

export const BriefSchema = z.object({
  id: z.string(),
  text: z.string(),
  ts: z.string(),
  archived: z.boolean().default(false),
})

export const EventSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().default('corridor'),
  status: z.string().default('active'),
  severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  brief: z.string().default(''),
  briefs: z.array(BriefSchema).default([]),
  region: z.object({
    center: z.array(z.number()).default([20, 0]),
    zoom: z.number().default(2),
    bounds: z.any().nullable().default(null),
  }).default({ center: [20, 0], zoom: 2, bounds: null }),
  corridor: z.array(z.any()).default([]),
  incidents: z.array(IncidentSchema.passthrough()).default([]),
  riskZones: z.array(z.any()).default([]),
  accessDenied: z.array(z.any()).default([]),
  bases: z.array(z.any()).default([]),
  drawings: z.array(z.any()).default([]),
  notebook: z.array(z.any()).default([]),
  createdAt: z.string().default(''),
  updatedAt: z.string().default(''),
}).passthrough()

// ─── localStorage Helpers ──────────────────────────────────────

const P = 'cp_'
function lsGet(k, fb) {
  try { const v = localStorage.getItem(P + k); return v !== null ? JSON.parse(v) : fb }
  catch { return fb }
}
function lsSet(k, v) {
  try { localStorage.setItem(P + k, JSON.stringify(v)) } catch (e) { console.warn('LS fail:', k, e) }
}

// ─── Validate on load ──────────────────────────────────────────

function safeParseEvents(raw) {
  if (!Array.isArray(raw) || !raw.length) return [SUDAN_EVENT]
  return raw.map(ev => { try { return EventSchema.parse(ev) } catch { return ev } })
}

// ─── Default AI Providers ─────────────────────────────────────

const DEFAULT_PROVIDERS = [
  { id: 'anthropic', name: 'Claude', url: 'https://api.anthropic.com/v1/messages', key: '', models: ['claude-opus-4-6', 'claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'], active: true },
  { id: 'openai', name: 'ChatGPT', url: 'https://api.openai.com/v1/chat/completions', key: '', models: ['gpt-5', 'gpt-4.1', 'gpt-4o', 'o3-mini'], active: false },
  { id: 'deepseek', name: 'DeepSeek', url: 'https://api.deepseek.com/chat/completions', key: '', models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v3'], active: false },
  { id: 'google', name: 'Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent', key: '', models: ['gemini-2.0-flash', 'gemini-2.5-pro-exp-03-25'], active: false },
  { id: 'xai', name: 'Grok', url: 'https://api.x.ai/v1/chat/completions', key: '', models: ['grok-3-mini', 'grok-3'], active: false },
]

// ─── Auto-Emoji Detection ─────────────────────────────────────

const TYPE_KEYWORDS = {
  bombardment: ['airstrike', 'bomb', 'shell', 'attack', 'aerial', 'mortar', 'shelling'],
  looting: ['loot', 'burn', 'ransack', 'pillage', 'rob', 'arson', 'raided'],
  'access-denial': ['evacuat', 'denied', 'block', 'restrict', 'ban', 'force out'],
  'control-change': ['control', 'capture', 'seize', 'took over', 'declared', 'occupy'],
  health: ['cholera', 'disease', 'outbreak', 'epidemic', 'malaria', 'hospital', 'clinic'],
  displacement: ['displac', 'fled', 'refugee', 'idp', 'migrat', 'flee', 'camp'],
  flood: ['flood', 'rain', 'inundat', 'water level', 'overflow'],
  earthquake: ['earthquake', 'quake', 'seismic', 'tremor'],
}

export function autoDetectType(text) {
  if (!text) return { type: 'displacement', icon: '⚠️', confidence: 0, allTypes: [] }
  const lower = text.toLowerCase()
  let bestType = null, bestScore = 0
  const allMatched = []
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    const score = keywords.filter(k => lower.includes(k)).length
    if (score > 0) allMatched.push(type)
    if (score > bestScore) { bestScore = score; bestType = type }
  }
  const primaryType = bestType || 'displacement'
  return {
    type: primaryType,
    icon: ICON_MAP[primaryType] || '⚠️',
    confidence: bestScore > 0 ? Math.min(1, bestScore / 3) : 0,
    allTypes: allMatched,
  }
}

// ─── Store ────────────────────────────────────────────────────

const useAppStore = create((set, get) => ({
  // ─── Settings ───────────────────────────────────────
  theme: lsGet('theme', 'dark'),
  lang: lsGet('lang', 'en'),
  fontSize: lsGet('fs', 13),
  mapAnims: lsGet('ma', true),
  baseLayerId: lsGet('bl', 'darklabel'),
  sentinel2: false,
  panelOpen: lsGet('po', true),
  detailOpen: false,
  detailTab: 'ai',
  view: 'map',
  showSettings: false,
  settingsTab: 'appearance',
  dataLayers: { incidents: true, access: true, risks: true, corridor: true },

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
    lsSet('theme', theme); set({ theme })
  },
  setLang(lang) { lsSet('lang', lang); set({ lang }) },
  setFontSize(fs) {
    document.documentElement.style.setProperty('--fs', fs + 'px')
    lsSet('fs', fs); set({ fontSize: fs })
  },
  setMapAnims(v) {
    const el = document.getElementById('root')
    if (el) el.classList.toggle('no-anim', !v)
    lsSet('ma', v); set({ mapAnims: v })
  },
  setBaseLayerId(id) { lsSet('bl', id); set({ baseLayerId: id }) },
  setSentinel2(v) { set({ sentinel2: v }) },
  setPanelOpen(v) { lsSet('po', v); set({ panelOpen: v }) },
  setDetailOpen(v) { set({ detailOpen: v }) },
  setDetailTab(v) { set({ detailTab: v }) },
  setView(v) { set({ view: v }) },
  setShowSettings(v) { set({ showSettings: v }) },
  setSettingsTab(v) { set({ settingsTab: v }) },
  toggleDataLayer(k) {
    set(s => ({ dataLayers: { ...s.dataLayers, [k]: !s.dataLayers[k] } }))
  },

  // ─── Events ─────────────────────────────────────────
  events: safeParseEvents(lsGet('events', [SUDAN_EVENT])),
  activeEventId: lsGet('ae', SUDAN_EVENT.id),

  setActiveEventId(id) { lsSet('ae', id); set({ activeEventId: id }) },

  addEvent(type) {
    const events = get().events
    const ev = createEvent({
      name: (EVENT_TYPES.find(t => t.id === type)?.name || 'Event') + ' ' + (events.length + 1),
      type,
    })
    const next = [...events, ev]
    lsSet('events', next)
    set({ events: next, activeEventId: ev.id, detailOpen: true, detailTab: 'ai' })
    return ev
  },

  deleteEvent(id) {
    const { events, activeEventId } = get()
    if (events.length <= 1) return
    const next = events.filter(e => e.id !== id)
    const newActive = activeEventId === id ? next[0]?.id : activeEventId
    lsSet('events', next); lsSet('ae', newActive)
    set({ events: next, activeEventId: newActive, detailOpen: false })
  },

  updateEvent(id, patch) {
    const next = get().events.map(e =>
      e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString().slice(0, 10) } : e
    )
    lsSet('events', next); set({ events: next })
  },

  selectEvent(id) {
    lsSet('ae', id)
    set({ activeEventId: id, detailOpen: true, detailTab: 'ai' })
  },

  // ─── Incidents (scoped to active event) ─────────────
  addIncident(incident) {
    const { activeEventId } = get()
    const ev = get().events.find(e => e.id === activeEventId)
    if (!ev) return null
    let validated
    try { validated = IncidentSchema.parse(incident) } catch { validated = incident }
    get().updateEvent(activeEventId, { incidents: [...(ev.incidents || []), validated] })
    return validated
  },

  updateIncident(incidentId, patch) {
    const { activeEventId } = get()
    const ev = get().events.find(e => e.id === activeEventId)
    if (!ev) return
    const next = (ev.incidents || []).map(i => i.id === incidentId ? { ...i, ...patch } : i)
    get().updateEvent(activeEventId, { incidents: next })
  },

  deleteIncident(incidentId) {
    const { activeEventId } = get()
    const ev = get().events.find(e => e.id === activeEventId)
    if (!ev) return
    get().updateEvent(activeEventId, { incidents: (ev.incidents || []).filter(i => i.id !== incidentId) })
  },

  /** Bulk add from AI analysis — dedup + auto-region */
  addIncidentsBulk(incidents) {
    const { activeEventId } = get()
    const ev = get().events.find(e => e.id === activeEventId)
    if (!ev) return 0
    const existing = ev.incidents || []
    const deduped = incidents.filter(ni =>
      !existing.some(ei => Math.abs(ei.a - ni.a) < 0.01 && Math.abs(ei.o - ni.o) < 0.01 && ei.tp === ni.tp)
    )
    if (!deduped.length) return 0
    const next = [...existing, ...deduped]
    const lats = next.map(i => i.a), lons = next.map(i => i.o)
    const pad = 2
    const newRegion = {
      center: [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lons) + Math.max(...lons)) / 2],
      zoom: 7,
      bounds: [[Math.min(...lats) - pad, Math.min(...lons) - pad], [Math.max(...lats) + pad, Math.max(...lons) + pad]],
    }
    get().updateEvent(activeEventId, { incidents: next, region: newRegion })
    return deduped.length
  },

  // ─── Briefs ─────────────────────────────────────────
  addBrief(text) {
    const { activeEventId } = get()
    const ev = get().events.find(e => e.id === activeEventId)
    if (!ev || !text?.trim()) return null
    const brief = { id: 'b_' + Date.now(), text: text.trim(), ts: new Date().toISOString(), archived: false }
    get().updateEvent(activeEventId, { briefs: [...(ev.briefs || []), brief], brief: text.trim() })
    return brief
  },

  archiveBrief(briefId) {
    const { activeEventId } = get()
    const ev = get().events.find(e => e.id === activeEventId)
    if (!ev) return
    const briefs = (ev.briefs || []).map(b => b.id === briefId ? { ...b, archived: true } : b)
    get().updateEvent(activeEventId, { briefs, brief: briefs.filter(b => !b.archived).pop()?.text || '' })
  },

  updateBriefText(briefId, text) {
    const { activeEventId } = get()
    const ev = get().events.find(e => e.id === activeEventId)
    if (!ev) return
    get().updateEvent(activeEventId, { briefs: (ev.briefs || []).map(b => b.id === briefId ? { ...b, text } : b) })
  },

  // ─── Notebook ───────────────────────────────────────
  addNote(text) {
    const { activeEventId } = get()
    const ev = get().events.find(e => e.id === activeEventId)
    if (!ev || !text?.trim()) return
    get().updateEvent(activeEventId, {
      notebook: [...(ev.notebook || []), { id: 'n_' + Date.now(), author: 'User', type: 'note', text: text.trim(), ts: new Date().toISOString() }],
    })
  },

  // ─── AI Providers ───────────────────────────────────
  aiProviders: lsGet('aip', DEFAULT_PROVIDERS),
  activeProvider: lsGet('apv', 'anthropic'),
  activeModel: lsGet('amd', 'claude-opus-4-6'),

  setActiveProvider(id) {
    const prov = get().aiProviders.find(p => p.id === id)
    const model = prov?.models?.[0] || ''
    lsSet('apv', id); lsSet('amd', model)
    set({ activeProvider: id, activeModel: model })
  },
  setActiveModel(model) { lsSet('amd', model); set({ activeModel: model }) },
  updateProviderKey(pid, key) {
    const next = get().aiProviders.map(p => p.id === pid ? { ...p, key } : p)
    lsSet('aip', next); set({ aiProviders: next })
  },

  // ─── Node Selection (Interactive Map → Sidebar) ─────
  selectedNodeId: null,
  sidebarNodeData: null,

  selectNode(type, id) {
    const ev = get().events.find(e => e.id === get().activeEventId)
    if (!ev) return
    let data = null
    if (type === 'incident') data = (ev.incidents || []).find(i => i.id === id)
    else if (type === 'base') data = (ev.bases || [])[parseInt(id?.replace('ba_', '') || 0)]
    else if (type === 'waypoint') data = (ev.corridor || [])[parseInt(id?.replace('wp_', '') || 0)]
    set({
      selectedNodeId: id,
      sidebarNodeData: { type, id, data: data || { _loading: true } },
      detailOpen: true,
      detailTab: type === 'incident' ? 'incidents' : 'overview',
    })
  },

  clearNodeSelection() { set({ selectedNodeId: null, sidebarNodeData: null }) },

  // ─── Chat (transient, not persisted) ────────────────
  chatMessages: {},
  chatHistory: {},

  addChatMessage(eventId, role, text) {
    set(s => ({
      chatMessages: { ...s.chatMessages, [eventId]: [...(s.chatMessages[eventId] || []), { role, text }] },
    }))
  },
  addChatHistory(eventId, messages) {
    set(s => ({
      chatHistory: { ...s.chatHistory, [eventId]: [...(s.chatHistory[eventId] || []), ...messages] },
    }))
  },
  replaceChatLastMessage(eventId, text) {
    set(s => {
      const msgs = [...(s.chatMessages[eventId] || [])]
      if (msgs.length) msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], text }
      return { chatMessages: { ...s.chatMessages, [eventId]: msgs } }
    })
  },
}))

// ─── Derived Selectors ────────────────────────────────────────

export const useActiveEvent = () => useAppStore(s =>
  s.events.find(e => e.id === s.activeEventId) || s.events[0] || null
)
export const useTheme = () => useAppStore(s => s.theme)
export const useLang = () => useAppStore(s => s.lang)
export const useAiReady = () => useAppStore(s => {
  const prov = s.aiProviders.find(p => p.id === s.activeProvider)
  return !!prov?.key
})

/**
 * useSortedIncidents — returns raw incidents array from store.
 * IMPORTANT: Do NOT sort/spread inside a Zustand selector — it creates
 * a new array reference every render → infinite re-render loop.
 * Sort in the component using useMemo instead.
 */
export const useRawIncidents = () => useAppStore(s => {
  const ev = s.events.find(e => e.id === s.activeEventId)
  return ev?.incidents || EMPTY_INCIDENTS
})
const EMPTY_INCIDENTS = [] // stable reference for empty state

export default useAppStore
