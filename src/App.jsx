import { useState, useRef, useEffect, useCallback } from 'react'
import 'leaflet/dist/leaflet.css'
import './styles/theme.css'
import {
  ICON_MAP, SEVERITY, FLOW_NODES, FLOW_CONNECTIONS,
  BASE_LAYERS, COPERNICUS_INSTANCE,
  SUDAN_EVENT, createEvent, computeStats, buildSystemPrompt, renderEventToMap
} from './data/events.js'

// ═══ HELPERS ═══
const ls = (k, fb) => { try { const v = localStorage.getItem('cp_' + k); return v !== null ? JSON.parse(v) : fb } catch { return fb } }
const ss = (k, v) => { try { localStorage.setItem('cp_' + k, JSON.stringify(v)) } catch {} }

function makeTile(Lf, id, theme) {
  const T = {
    osm: () => Lf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OSM", maxZoom: 19 }),
    dark: () => Lf.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { attribution: "© CartoDB", maxZoom: 20 }),
    hot: () => Lf.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", { attribution: "© OSM, HOT", maxZoom: 19 }),
    esri: () => Lf.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "© Esri", maxZoom: 19 }),
    topo: () => Lf.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { attribution: "© OpenTopoMap", maxZoom: 17 }),
  }
  if (id === 'osm' && theme === 'dark') return T.dark()
  return (T[id] || T.osm)()
}

// ═══════════════════════════════════════════════════════════════
export default function App() {
  // ── Global state ──
  const [theme, setTheme] = useState(() => ls('theme', 'light'))
  const [view, setView] = useState('map')
  const [panelOpen, setPanelOpen] = useState(() => ls('panelOpen', true))
  const [fs, setFs] = useState(() => ls('fs', 13))
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState('appearance')
  const [baseLayerId, setBaseLayerId] = useState(() => ls('bl', 'osm'))
  const [sentinel2, setSentinel2] = useState(false)
  const [dataLayers, setDataLayers] = useState({ incidents: true, access: true, risks: true, corridor: true })
  const [apiKey, setApiKey] = useState(() => ls('apiKey', ''))
  const [aiModel, setAiModel] = useState(() => ls('aiModel', 'claude-sonnet-4-20250514'))
  const [aiStatus, setAiStatus] = useState('unconfigured')

  // ── Multi-event state ──
  const [events, setEvents] = useState(() => ls('events', [SUDAN_EVENT]))
  const [activeEventId, setActiveEventId] = useState(() => ls('activeEvent', SUDAN_EVENT.id))
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailTab, setDetailTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')

  // ── AI Chat (per event) ──
  const [chatMsgs, setChatMsgs] = useState({})
  const [chatHist, setChatHist] = useState({})
  const [inputVal, setInputVal] = useState('')
  const [busy, setBusy] = useState(false)

  // ── Notebook ──
  const [noteInput, setNoteInput] = useState('')

  // ── Refs ──
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const LfRef = useRef(null)
  const baseLayerRef = useRef(null)
  const sentinelRef = useRef(null)
  const eventLayersRef = useRef({})
  const chatEndRef = useRef(null)
  const settingsRef = useRef(null)

  // ── Derived ──
  const activeEvent = events.find(e => e.id === activeEventId) || events[0]
  const stats = computeStats(activeEvent)
  const filteredEvents = events.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.brief.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const currentMsgs = chatMsgs[activeEventId] || [{ role: 'a', text: `Event "${activeEvent?.name}" loaded.\n\nAsk me about incidents, routes, risks, or logistics.` }]
  const sortedInc = [...(activeEvent?.incidents || [])].sort((a, b) => a.dt.localeCompare(b.dt))
  const quickPrompts = activeEvent ? ['Situation overview?', 'Risk assessment?', 'Route analysis?', 'Priority actions?'] : []

  // ═══ EFFECTS ═══
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); ss('theme', theme) }, [theme])
  useEffect(() => { document.documentElement.style.setProperty('--fs', fs + 'px'); ss('fs', fs) }, [fs])
  useEffect(() => { ss('panelOpen', panelOpen) }, [panelOpen])
  useEffect(() => { setAiStatus(apiKey ? 'ready' : 'unconfigured'); ss('apiKey', apiKey) }, [apiKey])
  useEffect(() => { ss('aiModel', aiModel) }, [aiModel])
  useEffect(() => { ss('events', events) }, [events])
  useEffect(() => { ss('activeEvent', activeEventId) }, [activeEventId])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [currentMsgs])

  useEffect(() => {
    const h = e => { if (settingsRef.current && !settingsRef.current.contains(e.target)) setShowSettings(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    const h = e => {
      if (e.shiftKey && e.key === 'Tab') { e.preventDefault(); setView(v => v === 'map' ? 'flow' : 'map') }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); setPanelOpen(v => !v) }
      if (e.key === 'Escape') setDetailOpen(false)
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  // ═══ MAP INIT ═══
  useEffect(() => {
    if (mapRef.current) return
    import('leaflet').then(mod => {
      const Lf = mod.default || mod; LfRef.current = Lf
      delete Lf.Icon.Default.prototype._getIconUrl
      Lf.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })
      const map = Lf.map(mapContainerRef.current, { zoomControl: true }).setView([9.5, 30.5], 6)
      mapRef.current = map
      const bl = makeTile(Lf, baseLayerId, theme); bl.addTo(map); baseLayerRef.current = bl
      // Render initial event
      if (activeEvent) {
        const layers = renderEventToMap(Lf, activeEvent)
        Object.values(layers).forEach(l => l.addTo(map))
        eventLayersRef.current = layers
        if (activeEvent.region?.bounds) map.fitBounds(activeEvent.region.bounds, { padding: [30, 30] })
      }
    })
  }, [])

  // ═══ SWITCH EVENT ON MAP ═══
  useEffect(() => {
    const map = mapRef.current, Lf = LfRef.current
    if (!map || !Lf || !activeEvent) return
    // Remove old layers
    Object.values(eventLayersRef.current).forEach(l => { try { map.removeLayer(l) } catch {} })
    // Add new
    const layers = renderEventToMap(Lf, activeEvent)
    Object.entries(layers).forEach(([key, l]) => { if (dataLayers[key] !== false) l.addTo(map) })
    eventLayersRef.current = layers
    if (activeEvent.region?.bounds) map.fitBounds(activeEvent.region.bounds, { padding: [30, 30] })
    setTimeout(() => map.invalidateSize(), 200)
  }, [activeEventId])

  // ═══ BASE LAYER ═══
  useEffect(() => {
    const map = mapRef.current, Lf = LfRef.current; if (!map || !Lf) return
    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current)
    const l = makeTile(Lf, baseLayerId, theme); l.addTo(map); l.bringToBack(); baseLayerRef.current = l; ss('bl', baseLayerId)
  }, [baseLayerId, theme])

  // ═══ SENTINEL ═══
  useEffect(() => {
    const map = mapRef.current, Lf = LfRef.current; if (!map || !Lf) return
    if (sentinelRef.current) { map.removeLayer(sentinelRef.current); sentinelRef.current = null }
    if (sentinel2) {
      const s = Lf.tileLayer.wms('https://sh.dataspace.copernicus.eu/ogc/wms/' + COPERNICUS_INSTANCE, {
        layers: 'TRUE-COLOR', tileSize: 512, attribution: '© Copernicus', format: 'image/png', transparent: true, maxcc: 30, minZoom: 6, maxZoom: 16, time: '2025-10-01/2026-02-12'
      }); s.addTo(map); sentinelRef.current = s
    }
  }, [sentinel2])

  // ═══ DATA LAYER TOGGLES ═══
  const toggleDL = useCallback(key => {
    setDataLayers(prev => {
      const next = { ...prev, [key]: !prev[key] }
      const map = mapRef.current, grp = eventLayersRef.current[key]
      if (map && grp) { if (next[key]) grp.addTo(map); else map.removeLayer(grp) }
      return next
    })
  }, [])

  useEffect(() => {
    if (view === 'map' && mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 200)
  }, [view, panelOpen, detailOpen])

  // ═══ EVENT CRUD ═══
  const addEvent = () => {
    const nev = createEvent({ name: 'New Event ' + (events.length + 1) })
    setEvents(prev => [...prev, nev])
    setActiveEventId(nev.id)
    setDetailOpen(true); setDetailTab('overview')
  }
  const deleteEvent = (id) => {
    if (events.length <= 1) return
    setEvents(prev => prev.filter(e => e.id !== id))
    if (activeEventId === id) setActiveEventId(events.find(e => e.id !== id)?.id)
    setDetailOpen(false)
  }
  const updateEvent = (id, patch) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString().slice(0, 10) } : e))
  }

  // ═══ SELECT EVENT ═══
  const selectEvent = (id) => {
    setActiveEventId(id); setDetailOpen(true); setDetailTab('overview')
  }

  // ═══ AI CHAT ═══
  const sendMsg = async () => {
    const msg = inputVal.trim(); if (!msg || busy) return
    const eid = activeEventId
    if (!apiKey) {
      setChatMsgs(p => ({ ...p, [eid]: [...(p[eid] || []), { role: 'u', text: msg }, { role: 'a', text: '⚠️ No API key. Go to ⚙️ Settings → 🤖 AI.' }] }))
      setInputVal(''); return
    }
    setChatMsgs(p => ({ ...p, [eid]: [...(p[eid] || []), { role: 'u', text: msg }] }))
    setInputVal(''); setBusy(true)
    const hist = [...(chatHist[eid] || []), { role: 'user', content: msg }]
    setChatHist(p => ({ ...p, [eid]: hist }))
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: aiModel, max_tokens: 1024, system: buildSystemPrompt(activeEvent), messages: hist.slice(-12) }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      let txt = ''; if (data.content) data.content.forEach(b => { if (b.type === 'text') txt += b.text })
      if (!txt) txt = 'No response.'
      setChatMsgs(p => ({ ...p, [eid]: [...(p[eid] || []), { role: 'a', text: txt }] }))
      setChatHist(p => ({ ...p, [eid]: [...(p[eid] || []), { role: 'assistant', content: txt }] }))
      setAiStatus('ready')
    } catch (err) {
      setChatMsgs(p => ({ ...p, [eid]: [...(p[eid] || []), { role: 'a', text: `❌ ${err.message}` }] }))
      if (err.message?.includes('auth')) setAiStatus('error')
    }
    setBusy(false)
  }

  const testApiKey = async () => {
    if (!apiKey) return; setBusy(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: aiModel, max_tokens: 20, messages: [{ role: 'user', content: 'Say OK' }] }),
      })
      const d = await res.json()
      if (d.error) { setAiStatus('error'); alert('❌ ' + d.error.message) } else { setAiStatus('ready'); alert('✅ AI ready!') }
    } catch (e) { setAiStatus('error'); alert('❌ ' + e.message) }
    setBusy(false)
  }

  // ═══ NOTEBOOK ═══
  const addNote = () => {
    const txt = noteInput.trim(); if (!txt) return
    const note = { id: 'n_' + Date.now(), author: 'User', type: 'note', text: txt, ts: new Date().toISOString() }
    updateEvent(activeEventId, { notebook: [...(activeEvent.notebook || []), note] })
    setNoteInput('')
  }

  const flyTo = (lat, lon) => { mapRef.current?.setView([lat, lon], 9) }

  const layerOptions = theme === 'dark' ? [{ id: 'dark', name: 'CartoDB Dark', desc: 'Dark' }, ...BASE_LAYERS.filter(l => l.id !== 'osm')] : BASE_LAYERS
  const dlDefs = [{ k: 'incidents', l: 'Incidents' }, { k: 'access', l: 'No-Access' }, { k: 'risks', l: 'Risk Zones' }, { k: 'corridor', l: 'Corridor' }]
  const svBadge = s => ({ fontSize: 'calc(var(--fs)*0.55)', padding: '1px 6px', borderRadius: 3, fontWeight: 700, background: (SEVERITY[s]||SEVERITY.medium).bg, color: (SEVERITY[s]||SEVERITY.medium).color })

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="app-layout">

      {/* ═══ LEFT PANEL — Event List ═══ */}
      <div className={`panel${panelOpen ? '' : ' collapsed'}`}>
        {/* Header */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 6px var(--danger-glow)' }} />
            <span style={{ fontSize: 'calc(var(--fs)*0.95)', fontWeight: 700, letterSpacing: '.04em' }}>CORRIDOR PLANNER</span>
            <span style={{ fontSize: 'calc(var(--fs)*0.5)', color: 'var(--danger)', background: 'var(--danger-bg)', padding: '2px 7px', borderRadius: 3, fontWeight: 700, marginLeft: 'auto' }}>
              {aiStatus === 'ready' ? '🟢 AI' : '⚪ AI'}
            </span>
          </div>
        </div>

        {/* Search + Add */}
        <div style={{ padding: '10px 16px', display: 'flex', gap: 6, borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search events..."
              style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: 8, fontSize: 'calc(var(--fs)*0.78)', background: 'var(--surface-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none' }} />
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 'calc(var(--fs)*0.78)', color: 'var(--text-faint)', pointerEvents: 'none' }}>🔍</span>
          </div>
          <button onClick={addEvent} title="Add event" style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border-input)', background: 'var(--surface-card)', color: 'var(--accent)', cursor: 'pointer', fontSize: 'calc(var(--fs)*1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>+</button>
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', padding: '8px 16px', gap: 6, borderBottom: '1px solid var(--border-subtle)' }}>
          {['map', 'flow'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 'calc(var(--fs)*0.72)', fontWeight: 600, fontFamily: 'inherit',
              background: view === v ? 'var(--text-primary)' : 'var(--surface-card)',
              color: view === v ? 'var(--bg-secondary)' : 'var(--text-muted)', transition: 'all .2s',
            }}>{v === 'map' ? '🗺️ MAP' : '🔀 FLOW'}</button>
          ))}
        </div>

        {/* Data layer toggles */}
        {view === 'map' && (
          <div style={{ display: 'flex', gap: 4, padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
            {dlDefs.map(d => (
              <button key={d.k} onClick={() => toggleDL(d.k)} style={{
                padding: '4px 8px', borderRadius: 5, cursor: 'pointer', fontSize: 'calc(var(--fs)*0.62)',
                fontFamily: 'inherit', fontWeight: 600, transition: 'all .2s',
                background: dataLayers[d.k] ? 'var(--accent-bg)' : 'var(--surface-card)',
                color: dataLayers[d.k] ? 'var(--accent)' : 'var(--text-faint)',
                border: '1px solid ' + (dataLayers[d.k] ? 'var(--accent)' : 'var(--border-primary)'),
              }}>{dataLayers[d.k] ? '●' : '○'} {d.l}</button>
            ))}
          </div>
        )}

        {/* Event list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {filteredEvents.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-faint)', fontSize: 'calc(var(--fs)*0.78)' }}>No events found</div>
          )}
          {filteredEvents.map(ev => (
            <div key={ev.id} onClick={() => selectEvent(ev.id)}
              style={{
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer', marginBottom: 6,
                background: ev.id === activeEventId ? 'var(--accent-bg)' : 'transparent',
                border: '1px solid ' + (ev.id === activeEventId ? 'var(--accent)' : 'var(--border-subtle)'),
                transition: 'all .15s',
              }}
              onMouseEnter={e => { if (ev.id !== activeEventId) e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { if (ev.id !== activeEventId) e.currentTarget.style.background = 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: (SEVERITY[ev.severity] || SEVERITY.medium).color, flexShrink: 0 }} />
                <span style={{ fontSize: 'calc(var(--fs)*0.82)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</span>
                <span style={svBadge(ev.severity)}>{ev.severity?.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 'calc(var(--fs)*0.62)', color: 'var(--text-muted)', marginTop: 4, paddingLeft: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.brief || 'No description'}</div>
              <div style={{ fontSize: 'calc(var(--fs)*0.55)', color: 'var(--text-faint)', marginTop: 3, paddingLeft: 14 }}>
                {ev.incidents?.length || 0} incidents • {ev.status} • {ev.updatedAt}
              </div>
            </div>
          ))}
        </div>

        {/* Stats bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, padding: '8px 12px', borderTop: '1px solid var(--border-subtle)' }}>
          {stats.map(s => (
            <div key={s.label} style={{ padding: '6px 2px', borderRadius: 5, textAlign: 'center', background: 'var(--surface-card)' }}>
              <div style={{ fontSize: 'calc(var(--fs)*1.1)', fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 'calc(var(--fs)*0.5)', color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ SIDEBAR TOGGLE ═══ */}
      <div className="sidebar-toggle" onClick={() => setPanelOpen(v => !v)} title="Ctrl+B">
        {panelOpen ? '◀' : '▶'}
      </div>

      {/* ═══ CANVAS (Map / Flow) ═══ */}
      <div className="canvas">
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', display: view === 'map' ? 'block' : 'none' }} />
        {view === 'flow' && (
          <div style={{ width: '100%', height: '100%', background: 'var(--bg-primary)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 16, left: 20, fontSize: 'calc(var(--fs)*0.88)', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '.06em', zIndex: 10 }}>PROJECT FLOW</div>
            <svg style={{ width: '100%', height: '100%' }}>
              <g>
                {FLOW_CONNECTIONS.map(([f, t]) => { const fn = FLOW_NODES.find(n => n.id === f), tn = FLOW_NODES.find(n => n.id === t); if (!fn || !tn) return null; return <path key={f + t} d={`M${fn.x} ${fn.y} C${fn.x + (tn.x - fn.x) * .4} ${fn.y},${fn.x + (tn.x - fn.x) * .6} ${tn.y},${tn.x} ${tn.y}`} fill="none" stroke={fn.color} strokeWidth="2" opacity=".3" /> })}
                {FLOW_NODES.map(n => (
                  <g key={n.id}><circle cx={n.x} cy={n.y} r="50" fill={n.color} opacity=".06" /><circle cx={n.x} cy={n.y} r="38" fill="var(--bg-secondary)" stroke={n.color} strokeWidth="2" /><text x={n.x} y={n.y - 4} textAnchor="middle" fill="var(--text-primary)" fontSize="12" fontWeight="600" style={{ fontFamily: "'Source Serif 4',Georgia,serif" }}>{n.label}</text><text x={n.x} y={n.y + 12} textAnchor="middle" fill={n.color} fontSize="10" style={{ fontFamily: "'Source Serif 4',Georgia,serif" }} opacity=".8">3 tasks</text></g>
                ))}
              </g>
            </svg>
          </div>
        )}

        {/* Map overlays */}
        {view === 'map' && (
          <>
            <div style={{ position: 'absolute', top: 14, left: 44, zIndex: 1000, display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'none' }}>
              <span style={{ fontSize: 'calc(var(--fs)*0.78)', fontWeight: 700, background: 'var(--glass)', padding: '4px 12px', borderRadius: 6, color: 'var(--text-primary)' }}>{activeEvent?.name || 'NO EVENT'}</span>
              {activeEvent?.severity === 'critical' && <span style={{ fontSize: 'calc(var(--fs)*0.58)', color: 'var(--danger)', background: 'var(--danger-bg)', padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>CRITICAL</span>}
            </div>
            {/* Timeline */}
            {sortedInc.length > 0 && (
              <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', gap: 5, background: 'var(--glass-strong)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: '6px 12px', boxShadow: 'var(--shadow-md)', alignItems: 'center' }}>
                <span style={{ fontSize: 'calc(var(--fs)*0.58)', color: 'var(--text-muted)', fontWeight: 600, marginRight: 4 }}>TIMELINE</span>
                {sortedInc.map(inc => (
                  <div key={inc.id} title={`${inc.dt}: ${inc.ti}`} onClick={() => flyTo(inc.a, inc.o)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '2px 5px', borderRadius: 5, transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontSize: 'calc(var(--fs)*0.85)' }}>{ICON_MAP[inc.tp] || '⚠️'}</span>
                    <span style={{ fontSize: 'calc(var(--fs)*0.45)', color: (SEVERITY[inc.s] || SEVERITY.medium).color, fontWeight: 600 }}>{inc.dt.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ RIGHT PANEL — Event Detail ═══ */}
      {detailOpen && activeEvent && (
        <div style={{
          width: 420, minWidth: 420, display: 'flex', flexDirection: 'column',
          background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-primary)',
          zIndex: 100, transition: 'all .3s', overflow: 'hidden',
        }}>
          {/* Detail header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={svBadge(activeEvent.severity)}>{activeEvent.severity?.toUpperCase()}</span>
                <span style={{ fontSize: 'calc(var(--fs)*0.55)', color: 'var(--text-faint)' }}>{activeEvent.status}</span>
              </div>
              <div style={{ fontSize: 'calc(var(--fs)*0.95)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeEvent.name}</div>
            </div>
            <button onClick={() => setDetailOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 'calc(var(--fs)*1.2)', lineHeight: 1, padding: '2px 4px' }}>✕</button>
          </div>

          {/* Detail tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', padding: '0 6px' }}>
            {[
              { id: 'overview', icon: '📋' },
              { id: 'incidents', icon: '⚠️' },
              { id: 'ai', icon: '🤖' },
              { id: 'notebook', icon: '📓' },
            ].map(t => (
              <button key={t.id} onClick={() => setDetailTab(t.id)} style={{
                flex: 1, padding: '10px 4px', border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 'calc(var(--fs)*0.78)', fontFamily: 'inherit',
                color: detailTab === t.id ? 'var(--accent)' : 'var(--text-faint)',
                borderBottom: detailTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'all .15s',
              }}>{t.icon} {t.id.charAt(0).toUpperCase() + t.id.slice(1)}</button>
            ))}
          </div>

          {/* Detail content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

            {/* ── OVERVIEW ── */}
            {detailTab === 'overview' && (
              <>
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5, marginBottom: 14 }}>
                  {stats.map(s => (
                    <div key={s.label} style={{ padding: '8px 2px', borderRadius: 6, textAlign: 'center', background: 'var(--surface-card)', border: '1px solid var(--border-primary)' }}>
                      <div style={{ fontSize: 'calc(var(--fs)*1.1)', fontWeight: 700, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 'calc(var(--fs)*0.5)', color: 'var(--text-muted)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {/* Brief */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 'calc(var(--fs)*0.68)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Brief</div>
                  <div style={{ fontSize: 'calc(var(--fs)*0.82)', lineHeight: 1.7, color: 'var(--text-secondary)', background: 'var(--surface-card)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-primary)' }}>{activeEvent.brief || 'No brief set.'}</div>
                </div>
                {/* Description */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 'calc(var(--fs)*0.68)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Description</div>
                  <div style={{ fontSize: 'calc(var(--fs)*0.78)', lineHeight: 1.8, color: 'var(--text-secondary)', background: 'var(--surface-card)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-primary)', whiteSpace: 'pre-wrap', maxHeight: 240, overflowY: 'auto' }}>{activeEvent.description || 'No description.'}</div>
                </div>
                {/* Meta */}
                <div style={{ fontSize: 'calc(var(--fs)*0.62)', color: 'var(--text-faint)', display: 'flex', gap: 16 }}>
                  <span>Created: {activeEvent.createdAt}</span>
                  <span>Updated: {activeEvent.updatedAt}</span>
                </div>
                {/* Delete */}
                {events.length > 1 && (
                  <button onClick={() => { if (confirm('Delete "' + activeEvent.name + '"?')) deleteEvent(activeEvent.id) }}
                    style={{ marginTop: 16, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'calc(var(--fs)*0.72)', fontWeight: 600, width: '100%' }}>
                    🗑️ Delete Event
                  </button>
                )}
              </>
            )}

            {/* ── INCIDENTS ── */}
            {detailTab === 'incidents' && (
              <>
                {sortedInc.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-faint)' }}>No incidents</div>}
                {sortedInc.map(inc => {
                  const sv = SEVERITY[inc.s] || SEVERITY.medium
                  return (
                    <div key={inc.id} onClick={() => flyTo(inc.a, inc.o)}
                      style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 6, cursor: 'pointer', border: '1px solid var(--border-primary)', background: 'var(--surface-card)', transition: 'all .15s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = sv.color}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-primary)'}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 'calc(var(--fs)*1)' }}>{ICON_MAP[inc.tp] || '⚠️'}</span>
                        <span style={{ flex: 1, fontSize: 'calc(var(--fs)*0.78)', fontWeight: 600 }}>{inc.ti}</span>
                        <span style={svBadge(inc.s)}>{inc.s.toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: 'calc(var(--fs)*0.68)', color: 'var(--text-muted)', marginTop: 4, paddingLeft: 28 }}>{inc.d}</div>
                      <div style={{ fontSize: 'calc(var(--fs)*0.58)', color: 'var(--text-faint)', marginTop: 3, paddingLeft: 28 }}>
                        {inc.dt} • ⚔️ {inc.ac} • 🏥 {inc.og}
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {/* ── AI CHAT ── */}
            {detailTab === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                  {currentMsgs.map((m, i) => (
                    <div key={i} style={{ animation: 'fadeIn .3s ease', maxWidth: '94%', alignSelf: m.role === 'u' ? 'flex-end' : 'flex-start' }}>
                      {m.role === 'a' && <div style={{ fontSize: 'calc(var(--fs)*0.55)', color: 'var(--text-faint)', marginBottom: 2, paddingLeft: 4 }}>🤖 AI</div>}
                      <div style={{
                        padding: '10px 12px', borderRadius: 10, fontSize: 'calc(var(--fs)*0.82)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        ...(m.role === 'u' ? { background: 'var(--surface-msg-user)', color: 'var(--surface-msg-user-text)', borderBottomRightRadius: 3 }
                          : { background: 'var(--surface-msg-ai)', border: '1px solid var(--surface-msg-ai-border)', color: 'var(--surface-msg-ai-text)', borderBottomLeftRadius: 3 }),
                      }}>{m.text}</div>
                    </div>
                  ))}
                  {busy && (
                    <div style={{ alignSelf: 'flex-start' }}>
                      <div style={{ fontSize: 'calc(var(--fs)*0.55)', color: 'var(--text-faint)', marginBottom: 2, paddingLeft: 4 }}>🤖 AI</div>
                      <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--surface-msg-ai)', border: '1px solid var(--surface-msg-ai-border)', borderBottomLeftRadius: 3 }}>
                        <span style={{ animation: 'blink 1.2s infinite', color: 'var(--text-muted)' }}>Thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                {/* Quick prompts */}
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 8 }}>
                  {quickPrompts.map(q => (
                    <button key={q} onClick={() => setInputVal(q)} style={{
                      background: 'var(--surface-card)', border: '1px solid var(--border-input)', color: 'var(--text-secondary)',
                      fontSize: 'calc(var(--fs)*0.58)', padding: '3px 7px', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
                    }}>{q}</button>
                  ))}
                </div>
                {/* Input */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={inputVal} onChange={e => setInputVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMsg()}
                    placeholder={busy ? 'Thinking...' : apiKey ? 'Ask about this event...' : 'Set API key in ⚙️'}
                    disabled={busy}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, fontSize: 'calc(var(--fs)*0.78)', background: 'var(--surface-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none' }} />
                  <button onClick={sendMsg} disabled={busy} style={{
                    padding: '10px 14px', borderRadius: 8, border: 'none', background: busy ? 'var(--text-faint)' : 'var(--text-primary)',
                    color: 'var(--bg-secondary)', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700,
                  }}>↵</button>
                </div>
              </div>
            )}

            {/* ── NOTEBOOK ── */}
            {detailTab === 'notebook' && (
              <>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {(!activeEvent.notebook || activeEvent.notebook.length === 0) && (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-faint)', fontSize: 'calc(var(--fs)*0.78)' }}>No notes yet. Add the first entry.</div>
                  )}
                  {(activeEvent.notebook || []).map(note => (
                    <div key={note.id} style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 6, background: 'var(--surface-card)', border: '1px solid var(--border-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 'calc(var(--fs)*0.68)', fontWeight: 700, color: 'var(--accent)' }}>{note.author}</span>
                        <span style={{ fontSize: 'calc(var(--fs)*0.55)', padding: '1px 5px', borderRadius: 3, background: 'var(--accent-bg)', color: 'var(--accent)' }}>{note.type}</span>
                        <span style={{ fontSize: 'calc(var(--fs)*0.55)', color: 'var(--text-faint)', marginLeft: 'auto' }}>
                          {new Date(note.ts).toLocaleDateString()} {new Date(note.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: 'calc(var(--fs)*0.78)', lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{note.text}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <input value={noteInput} onChange={e => setNoteInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addNote()}
                    placeholder="Add a note..."
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, fontSize: 'calc(var(--fs)*0.78)', background: 'var(--surface-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none' }} />
                  <button onClick={addNote} style={{
                    padding: '10px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)',
                    color: '#FFF', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 'calc(var(--fs)*0.78)',
                  }}>Add</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ SETTINGS FAB ═══ */}
      <div ref={settingsRef} style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 9999 }}>
        <button onClick={() => setShowSettings(v => !v)} style={{
          width: 40, height: 40, borderRadius: 12, border: '1px solid var(--border-primary)',
          background: showSettings ? 'var(--text-primary)' : 'var(--bg-secondary)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)', transition: 'all .2s',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={showSettings ? 'var(--bg-secondary)' : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {showSettings && (
          <div style={{ position: 'absolute', bottom: 50, left: 0, width: 320, maxHeight: '70vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, boxShadow: 'var(--shadow-lg)', animation: 'fadeIn .2s ease' }}>
            <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: 'calc(var(--fs)*0.9)', fontWeight: 700 }}>⚙️ Settings</h3>
              <span style={{ fontSize: 'calc(var(--fs)*0.55)', color: 'var(--text-faint)', marginLeft: 'auto' }}>v2.0</span>
            </div>
            <div style={{ display: 'flex', gap: 2, padding: '8px 16px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              {[{ id: 'appearance', l: '🎨' }, { id: 'map', l: '🗺️' }, { id: 'ai', l: '🤖' }, { id: 'about', l: 'ℹ️' }].map(t => (
                <button key={t.id} onClick={() => setSettingsTab(t.id)} style={{
                  padding: '6px 12px', border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: 'calc(var(--fs)*0.85)', fontFamily: 'inherit',
                  color: settingsTab === t.id ? 'var(--accent)' : 'var(--text-faint)',
                  borderBottom: settingsTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                }}>{t.l}</button>
              ))}
            </div>
            <div style={{ padding: '14px 16px' }}>
              {settingsTab === 'appearance' && (<>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 'calc(var(--fs)*0.72)', fontWeight: 700, marginBottom: 8 }}>Theme</div>
                  <div style={{ display: 'flex', background: 'var(--surface-card)', borderRadius: 8, border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
                    {['light', 'dark'].map(t => (
                      <button key={t} onClick={() => { setTheme(t); if (t === 'dark' && baseLayerId === 'osm') setBaseLayerId('dark'); if (t === 'light' && baseLayerId === 'dark') setBaseLayerId('osm') }} style={{
                        flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 'calc(var(--fs)*0.72)',
                        background: theme === t ? 'var(--accent)' : 'transparent', color: theme === t ? '#FFF' : 'var(--text-muted)',
                      }}>{t === 'light' ? '☀️ Light' : '🌙 Dark'}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 'calc(var(--fs)*0.68)', color: 'var(--text-secondary)', fontWeight: 600 }}>Font Size</span>
                    <span style={{ fontSize: 'calc(var(--fs)*0.68)', color: 'var(--text-muted)', fontWeight: 700, background: 'var(--surface-card)', padding: '2px 6px', borderRadius: 4 }}>{fs}px</span>
                  </div>
                  <input type="range" min="10" max="20" value={fs} onChange={e => setFs(Number(e.target.value))}
                    style={{ width: '100%', height: 4, WebkitAppearance: 'none', appearance: 'none', background: 'var(--border-primary)', borderRadius: 4, cursor: 'pointer', accentColor: 'var(--accent)' }} />
                </div>
              </>)}
              {settingsTab === 'map' && (<>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 'calc(var(--fs)*0.72)', fontWeight: 700, marginBottom: 6 }}>Base Layer</div>
                  {layerOptions.map(b => (
                    <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 5, cursor: 'pointer', fontSize: 'calc(var(--fs)*0.72)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <input type="radio" name="bl" checked={baseLayerId === b.id} onChange={() => setBaseLayerId(b.id)} style={{ accentColor: 'var(--accent)', margin: 0 }} />
                      <b>{b.name}</b><span style={{ color: 'var(--text-faint)', fontSize: 'calc(var(--fs)*0.55)', marginLeft: 'auto' }}>{b.desc}</span>
                    </label>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                  <div style={{ fontSize: 'calc(var(--fs)*0.72)', fontWeight: 700, marginBottom: 6 }}>🛰️ Overlay</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 5, cursor: 'pointer', fontSize: 'calc(var(--fs)*0.72)' }}>
                    <input type="checkbox" checked={sentinel2} onChange={e => setSentinel2(e.target.checked)} style={{ accentColor: 'var(--accent)', margin: 0 }} />
                    <b>Sentinel-2 L2A</b><span style={{ color: 'var(--text-faint)', fontSize: 'calc(var(--fs)*0.55)', marginLeft: 'auto' }}>Copernicus</span>
                  </label>
                  <div style={{ fontSize: 'calc(var(--fs)*0.5)', color: 'var(--text-faint)', padding: '2px 8px' }}>Zoom ≥ 6 required</div>
                </div>
              </>)}
              {settingsTab === 'ai' && (<>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 'calc(var(--fs)*0.72)', fontWeight: 700, marginBottom: 6 }}>Claude API Key</div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-ant-..."
                      style={{ flex: 1, padding: '8px 10px', borderRadius: 7, fontSize: 'calc(var(--fs)*0.72)', background: 'var(--surface-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', fontFamily: 'monospace', outline: 'none' }} />
                    <button onClick={testApiKey} disabled={!apiKey || busy} style={{ padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border-input)', background: 'var(--surface-card)', color: 'var(--text-secondary)', cursor: apiKey && !busy ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontSize: 'calc(var(--fs)*0.68)', fontWeight: 600 }}>Test</button>
                  </div>
                  <div style={{ fontSize: 'calc(var(--fs)*0.5)', color: 'var(--text-faint)', marginTop: 4 }}>Stored locally. Sent only to Anthropic API.</div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 'calc(var(--fs)*0.72)', fontWeight: 700, marginBottom: 6 }}>Model</div>
                  <div style={{ display: 'flex', background: 'var(--surface-card)', borderRadius: 7, border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
                    {[{ id: 'claude-sonnet-4-20250514', l: 'Sonnet 4' }, { id: 'claude-haiku-4-5-20251001', l: 'Haiku 4.5' }].map(m => (
                      <button key={m.id} onClick={() => setAiModel(m.id)} style={{
                        flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 'calc(var(--fs)*0.68)',
                        background: aiModel === m.id ? 'var(--accent)' : 'transparent', color: aiModel === m.id ? '#FFF' : 'var(--text-muted)',
                      }}>{m.l}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: aiStatus === 'ready' ? '#3B7A57' : aiStatus === 'error' ? '#C73E1D' : '#8B7355' }} />
                  <span style={{ fontSize: 'calc(var(--fs)*0.68)', color: 'var(--text-muted)' }}>
                    {aiStatus === 'ready' ? 'Connected' : aiStatus === 'error' ? 'Error' : 'Not configured'}
                  </span>
                </div>
              </>)}
              {settingsTab === 'about' && (
                <div style={{ fontSize: 'calc(var(--fs)*0.72)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  <div style={{ fontWeight: 700, fontSize: 'calc(var(--fs)*0.88)', marginBottom: 6 }}>Corridor Planner</div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 10 }}>Map the crisis. Plan the corridor. Save lives.</div>
                  <div>Version 2.0 • Phase 2</div>
                  <div>React + Leaflet + Claude AI</div>
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border-subtle)', fontSize: 'calc(var(--fs)*0.58)', color: 'var(--text-faint)' }}>
                    Ctrl+B — Toggle sidebar<br />Shift+Tab — Map/Flow<br />Esc — Close detail panel
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
