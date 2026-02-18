import { useState, useRef, useEffect, useCallback } from 'react'
import 'leaflet/dist/leaflet.css'
import './styles/theme.css'
import {
  CORRIDOR, RISK_ZONES, INCIDENTS, ACCESS_DENIED, BASES,
  ICON_MAP, SEVERITY, STATS, FLOW_NODES, FLOW_CONNECTIONS,
  BASE_LAYERS, COPERNICUS_INSTANCE, QUICK_PROMPTS, buildSystemPrompt,
  DEFAULT_EVENT
} from './data/events.js'

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function loadSetting(key, fallback) {
  try { const v = localStorage.getItem('cp_' + key); return v !== null ? JSON.parse(v) : fallback }
  catch { return fallback }
}
function saveSetting(key, val) {
  try { localStorage.setItem('cp_' + key, JSON.stringify(val)) } catch {}
}

// ═══════════════════════════════════════════════════════════════
// TILE FACTORIES
// ═══════════════════════════════════════════════════════════════
function makeTile(Lf, id, theme) {
  const tiles = {
    osm: () => Lf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 }),
    dark: () => Lf.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { attribution: "© CartoDB", maxZoom: 20 }),
    hot: () => Lf.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap, HOT", maxZoom: 19 }),
    esri: () => Lf.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "© Esri, Maxar", maxZoom: 19 }),
    topo: () => Lf.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { attribution: "© OpenTopoMap", maxZoom: 17 }),
  }
  // auto-select dark tile when in dark theme and using default
  if (id === 'osm' && theme === 'dark') return tiles.dark()
  return (tiles[id] || tiles.osm)()
}

// ═══════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  // ── State ──
  const [theme, setTheme] = useState(() => loadSetting('theme', 'light'))
  const [view, setView] = useState('map')
  const [panelOpen, setPanelOpen] = useState(() => loadSetting('panelOpen', true))
  const [fs, setFs] = useState(() => loadSetting('fs', 13))
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState('appearance')
  const [baseLayerId, setBaseLayerId] = useState(() => loadSetting('bl', 'osm'))
  const [sentinel2, setSentinel2] = useState(false)
  const [dataLayers, setDataLayers] = useState({ incidents: true, access: true, risks: true, corridor: true })
  const [apiKey, setApiKey] = useState(() => loadSetting('apiKey', ''))
  const [aiModel, setAiModel] = useState(() => loadSetting('aiModel', 'claude-sonnet-4-20250514'))
  const [msgs, setMsgs] = useState([{
    role: 'a',
    text: 'Humanitarian Corridor Planner is active.\n\nSudan → South Sudan corridor loaded with Jonglei field briefing data (2026-02-09). 7 incidents, 3 access-denied zones, and a cholera alert are plotted.\n\nAsk me anything about the corridor, routes, risks, or logistics.'
  }])
  const [inputVal, setInputVal] = useState('')
  const [busy, setBusy] = useState(false)
  const [chatHistory, setChatHistory] = useState([])
  const [aiStatus, setAiStatus] = useState('unconfigured') // unconfigured | ready | error

  // ── Refs ──
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const leafletRef = useRef(null)
  const baseLayerRef = useRef(null)
  const sentinelRef = useRef(null)
  const dataGroupRefs = useRef({})
  const chatEndRef = useRef(null)
  const settingsRef = useRef(null)

  // ── Theme ──
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    saveSetting('theme', theme)
  }, [theme])

  // ── Font size ──
  useEffect(() => {
    document.documentElement.style.setProperty('--fs', fs + 'px')
    saveSetting('fs', fs)
  }, [fs])

  // ── Panel persistence ──
  useEffect(() => { saveSetting('panelOpen', panelOpen) }, [panelOpen])

  // ── API key status ──
  useEffect(() => {
    setAiStatus(apiKey ? 'ready' : 'unconfigured')
    saveSetting('apiKey', apiKey)
  }, [apiKey])
  useEffect(() => { saveSetting('aiModel', aiModel) }, [aiModel])

  // ── Chat scroll ──
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  // ── Settings close on outside click ──
  useEffect(() => {
    const h = (e) => { if (settingsRef.current && !settingsRef.current.contains(e.target)) setShowSettings(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const h = (e) => {
      if (e.shiftKey && e.key === 'Tab') { e.preventDefault(); setView(v => v === 'map' ? 'flow' : 'map') }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); setPanelOpen(v => !v) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // ═══ MAP INIT ═══
  useEffect(() => {
    if (mapRef.current) return
    import('leaflet').then((mod) => {
      const Lf = mod.default || mod
      leafletRef.current = Lf

      delete Lf.Icon.Default.prototype._getIconUrl
      Lf.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = Lf.map(mapContainerRef.current, { zoomControl: true }).setView([9.5, 30.5], 6)
      mapRef.current = map

      const baseTile = makeTile(Lf, baseLayerId, theme)
      baseTile.addTo(map)
      baseLayerRef.current = baseTile

      // Data layers
      const g = { corridor: Lf.layerGroup(), risks: Lf.layerGroup(), access: Lf.layerGroup(), incidents: Lf.layerGroup() }
      const basesGrp = Lf.layerGroup()

      // Corridor line
      const coords = CORRIDOR.map(p => [p.a, p.o])
      Lf.polyline(coords, { color: '#8B4513', weight: 3, opacity: 0.7, dashArray: '10 6' }).addTo(g.corridor)
      Lf.polyline(coords, { color: '#8B4513', weight: 12, opacity: 0.08 }).addTo(g.corridor)
      CORRIDOR.forEach(p => {
        const c = p.t === 'city' ? '#3D2B1F' : p.t === 'base' ? '#2E86AB' : '#8B7355'
        const r = p.t === 'city' ? 7 : p.t === 'base' ? 6 : 4
        Lf.circleMarker([p.a, p.o], { radius: r, fillColor: c, color: '#FFF', weight: 2, fillOpacity: 0.9 })
          .bindPopup(`<h3>${p.n}</h3><p>${p.d}</p><p class='mt'>${p.a.toFixed(2)}°N, ${p.o.toFixed(2)}°E</p>`)
          .addTo(g.corridor)
      })

      // Risk zones
      RISK_ZONES.forEach(r => {
        const sv = SEVERITY[r.s] || SEVERITY.medium
        Lf.circle([r.a, r.o], { radius: r.r, fillColor: sv.color, color: sv.color, weight: 1.5, fillOpacity: 0.08, dashArray: '6 4' })
          .bindPopup(`<h3>${r.n}</h3><span class='sv' style='background:${sv.bg};color:${sv.color}'>${r.s.toUpperCase()}</span><p>${r.d}</p>`)
          .addTo(g.risks)
      })

      // Access denied
      ACCESS_DENIED.forEach(z => {
        Lf.circle([z.a, z.o], { radius: z.r, fillColor: '#C73E1D', color: '#C73E1D', weight: 2, fillOpacity: 0.1, dashArray: '8 4' }).addTo(g.access)
        Lf.circle([z.a, z.o], { radius: z.r * 0.7, fillColor: '#C73E1D', color: '#C73E1D', weight: 1, fillOpacity: 0.05 }).addTo(g.access)
        Lf.marker([z.a, z.o], { icon: Lf.divIcon({ className: 'dl', html: `🚫 ${z.n}<br><span style='font-size:0.8em;opacity:0.7'>NO ACCESS</span>`, iconSize: [130, 35] }) }).addTo(g.access)
      })

      // Incidents
      INCIDENTS.forEach(i => {
        const sv = SEVERITY[i.s] || SEVERITY.medium
        const ic = ICON_MAP[i.tp] || '⚠️'
        Lf.circleMarker([i.a, i.o], { radius: i.s === 'critical' ? 10 : 8, fillColor: sv.color, color: '#FFF', weight: 2, fillOpacity: 0.85 })
          .bindPopup(`<h3>${ic} ${i.ti}</h3><span class='sv' style='background:${sv.bg};color:${sv.color}'>${i.s.toUpperCase()}</span> <span class='mt'>${i.dt}</span><p>${i.d}</p><p class='mt'>⚔️ ${i.ac} &nbsp; 🏥 ${i.og}</p>`)
          .addTo(g.incidents)
        if (i.s === 'critical') Lf.circleMarker([i.a, i.o], { radius: 18, fillColor: sv.color, color: sv.color, weight: 1, fillOpacity: 0.12 }).addTo(g.incidents)
      })

      // Bases
      BASES.forEach(b => {
        Lf.marker([b.a, b.o], { icon: Lf.divIcon({ className: 'dl', html: `<span style='color:#2E86AB;font-size:16px'>🏕️</span>`, iconSize: [20, 20] }) })
          .bindPopup(`<h3>🏕️ ${b.n}</h3><p><b>Status:</b> ${b.st}</p><p><b>Capacity:</b> ${b.c}</p>`)
          .addTo(basesGrp)
      })

      Object.values(g).forEach(x => x.addTo(map))
      basesGrp.addTo(map)
      dataGroupRefs.current = g
      map.fitBounds([[4.5, 26], [16, 34]], { padding: [30, 30] })
    })
  }, [])

  // ═══ BASE LAYER SWITCH ═══
  useEffect(() => {
    const map = mapRef.current, Lf = leafletRef.current
    if (!map || !Lf) return
    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current)
    const layer = makeTile(Lf, baseLayerId, theme)
    layer.addTo(map); layer.bringToBack()
    baseLayerRef.current = layer
    saveSetting('bl', baseLayerId)
  }, [baseLayerId, theme])

  // ═══ SENTINEL-2 ═══
  useEffect(() => {
    const map = mapRef.current, Lf = leafletRef.current
    if (!map || !Lf) return
    if (sentinelRef.current) { map.removeLayer(sentinelRef.current); sentinelRef.current = null }
    if (sentinel2) {
      const s = Lf.tileLayer.wms('https://sh.dataspace.copernicus.eu/ogc/wms/' + COPERNICUS_INSTANCE, {
        layers: 'TRUE-COLOR', tileSize: 512, attribution: '© Copernicus Sentinel',
        format: 'image/png', transparent: true, maxcc: 30, minZoom: 6, maxZoom: 16,
        time: '2025-10-01/2026-02-12'
      })
      s.addTo(map); sentinelRef.current = s
    }
  }, [sentinel2])

  // ═══ DATA LAYER TOGGLES ═══
  const toggleDataLayer = useCallback((key) => {
    setDataLayers(prev => {
      const next = { ...prev, [key]: !prev[key] }
      const map = mapRef.current, grp = dataGroupRefs.current[key]
      if (map && grp) { if (next[key]) grp.addTo(map); else map.removeLayer(grp) }
      return next
    })
  }, [])

  // ═══ MAP INVALIDATE ON VIEW/PANEL CHANGE ═══
  useEffect(() => {
    if (view === 'map' && mapRef.current) setTimeout(() => mapRef.current.invalidateSize(), 200)
  }, [view, panelOpen])

  // ═══ AI SEND ═══
  const sendMessage = async () => {
    const msg = inputVal.trim()
    if (!msg || busy) return
    if (!apiKey) {
      setMsgs(prev => [...prev, { role: 'u', text: msg }, { role: 'a', text: '⚠️ No API key configured.\n\nGo to ⚙️ Settings → AI Configuration and enter your Claude API key to enable the AI assistant.' }])
      setInputVal('')
      return
    }
    setMsgs(prev => [...prev, { role: 'u', text: msg }])
    setInputVal(''); setBusy(true)
    const newHist = [...chatHistory, { role: 'user', content: msg }]
    setChatHistory(newHist)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: aiModel, max_tokens: 1024, system: buildSystemPrompt(DEFAULT_EVENT), messages: newHist.slice(-12) }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message || 'API error')
      let text = ''
      if (data.content) data.content.forEach(b => { if (b.type === 'text') text += b.text })
      if (!text) text = 'No response received.'
      setMsgs(prev => [...prev, { role: 'a', text }])
      setChatHistory(prev => [...prev, { role: 'assistant', content: text }])
      setAiStatus('ready')
    } catch (err) {
      setMsgs(prev => [...prev, { role: 'a', text: `❌ ${err.message}\n\nCheck your API key in Settings → AI Configuration.` }])
      if (err.message.includes('auth') || err.message.includes('key')) setAiStatus('error')
    }
    setBusy(false)
  }

  const testApiKey = async () => {
    if (!apiKey) return
    setBusy(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: aiModel, max_tokens: 20, messages: [{ role: 'user', content: 'Say OK' }] }),
      })
      const data = await res.json()
      if (data.error) { setAiStatus('error'); alert('❌ API Error: ' + (data.error.message || 'Invalid key')) }
      else { setAiStatus('ready'); alert('✅ API key is valid! AI assistant is ready.') }
    } catch (err) { setAiStatus('error'); alert('❌ Connection error: ' + err.message) }
    setBusy(false)
  }

  const flyTo = (lat, lon) => { mapRef.current?.setView([lat, lon], 9) }
  const sortedInc = [...INCIDENTS].sort((a, b) => a.dt.localeCompare(b.dt))

  // ── Layer list with theme-aware options ──
  const layerOptions = theme === 'dark'
    ? [{ id: 'dark', name: 'CartoDB Dark', desc: 'Dark mode' }, ...BASE_LAYERS.filter(l => l.id !== 'osm')]
    : BASE_LAYERS

  const dataLayerDefs = [
    { k: 'incidents', label: 'Incidents', c: 'var(--danger)' },
    { k: 'access', label: 'No-Access', c: '#9B2915' },
    { k: 'risks', label: 'Risk Zones', c: 'var(--warning)' },
    { k: 'corridor', label: 'Corridor', c: '#8B4513' },
  ]

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  const s = (obj) => obj // inline style passthrough

  return (
    <div className="app-layout">
      {/* ═══ PANEL ═══ */}
      <div className={`panel${panelOpen ? '' : ' collapsed'}`}>

        {/* Header */}
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h1 style={{ fontSize: 'calc(var(--fs)*1.05)', fontWeight: 700, letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 8px var(--danger-glow)', display: 'inline-block' }} />
            CORRIDOR PLANNER
            <span style={{ fontSize: 'calc(var(--fs)*0.58)', color: 'var(--danger)', background: 'var(--danger-bg)', padding: '2px 8px', borderRadius: 3, fontWeight: 700, marginLeft: 'auto' }}>
              {aiStatus === 'ready' ? '🟢 AI READY' : aiStatus === 'error' ? '🔴 AI ERROR' : '⚪ AI OFF'}
            </span>
          </h1>
          <div style={{ fontSize: 'calc(var(--fs)*0.72)', color: 'var(--text-muted)', marginTop: 4 }}>
            Sudan → South Sudan • Jonglei Briefing 2026-02-09
          </div>
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', padding: '10px 18px', gap: 8, borderBottom: '1px solid var(--border-subtle)' }}>
          {['map', 'flow'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 'calc(var(--fs)*0.82)', fontWeight: 600, fontFamily: 'inherit', letterSpacing: '.04em',
              background: view === v ? (v === 'map' ? 'var(--text-primary)' : 'var(--accent)') : 'var(--surface-card)',
              color: view === v ? 'var(--bg-secondary)' : 'var(--text-muted)', transition: 'all .2s',
            }}>{v === 'map' ? '🗺️ MAP' : '🔀 FLOW'}</button>
          ))}
        </div>

        {/* Data layer toggles */}
        {view === 'map' && (
          <div style={{ display: 'flex', gap: 5, padding: '10px 18px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
            {dataLayerDefs.map(l => (
              <button key={l.k} onClick={() => toggleDataLayer(l.k)} style={{
                padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 'calc(var(--fs)*0.68)',
                fontFamily: 'inherit', fontWeight: 600, transition: 'all .2s',
                background: dataLayers[l.k] ? 'var(--accent-bg)' : 'var(--surface-card)',
                color: dataLayers[l.k] ? 'var(--accent)' : 'var(--text-faint)',
                border: '1px solid ' + (dataLayers[l.k] ? 'var(--accent)' : 'var(--border-primary)'),
                opacity: dataLayers[l.k] ? 1 : 0.7,
              }}>{dataLayers[l.k] ? '●' : '○'} {l.label}</button>
            ))}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, padding: '10px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
          {STATS.map(st => (
            <div key={st.label} style={{ padding: '8px 4px', borderRadius: 6, textAlign: 'center', background: 'var(--surface-card)', border: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: 'calc(var(--fs)*1.2)', fontWeight: 700, color: st.color }}>{st.value}</div>
              <div style={{ fontSize: 'calc(var(--fs)*0.58)', color: 'var(--text-muted)', marginTop: 2 }}>{st.label}</div>
            </div>
          ))}
        </div>

        {/* Chat messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ animation: 'fadeIn .3s ease', maxWidth: '94%', alignSelf: m.role === 'u' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'a' && <div style={{ fontSize: 'calc(var(--fs)*0.62)', color: 'var(--text-faint)', marginBottom: 3, paddingLeft: 4 }}>🤖 AI Assistant</div>}
              <div style={{
                padding: '12px 14px', borderRadius: 12, fontSize: 'calc(var(--fs)*0.88)', lineHeight: 1.75,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                ...(m.role === 'u'
                  ? { background: 'var(--surface-msg-user)', color: 'var(--surface-msg-user-text)', borderBottomRightRadius: 3 }
                  : { background: 'var(--surface-msg-ai)', border: '1px solid var(--surface-msg-ai-border)', color: 'var(--surface-msg-ai-text)', borderBottomLeftRadius: 3, boxShadow: 'var(--shadow-sm)' }),
              }}>{m.text}</div>
            </div>
          ))}
          {busy && (
            <div style={{ animation: 'fadeIn .2s ease', alignSelf: 'flex-start', maxWidth: '94%' }}>
              <div style={{ fontSize: 'calc(var(--fs)*0.62)', color: 'var(--text-faint)', marginBottom: 3, paddingLeft: 4 }}>🤖 AI Assistant</div>
              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--surface-msg-ai)', border: '1px solid var(--surface-msg-ai-border)', borderBottomLeftRadius: 3 }}>
                <span style={{ animation: 'blink 1.2s infinite', color: 'var(--text-muted)' }}>Thinking...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick prompts */}
        <div style={{ padding: '8px 18px 0', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {QUICK_PROMPTS.map(q => (
            <button key={q} onClick={() => setInputVal(q)} style={{
              background: 'var(--surface-card)', border: '1px solid var(--border-input)', color: 'var(--text-secondary)',
              fontSize: 'calc(var(--fs)*0.62)', padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
            }}>{q}</button>
          ))}
        </div>

        {/* Input */}
        <div style={{ padding: '12px 18px 16px', display: 'flex', gap: 8 }}>
          <input value={inputVal} onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder={busy ? 'AI is responding...' : apiKey ? 'Ask about the corridor...' : 'Set API key in ⚙️ Settings'}
            disabled={busy}
            style={{
              flex: 1, padding: '12px 14px', borderRadius: 10, fontSize: 'calc(var(--fs)*0.88)',
              background: 'var(--surface-input)', border: '1px solid var(--border-input)',
              color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', opacity: busy ? 0.6 : 1,
            }} />
          <button onClick={sendMessage} disabled={busy} style={{
            padding: '12px 18px', borderRadius: 10, border: 'none',
            background: busy ? 'var(--text-faint)' : 'var(--text-primary)',
            color: 'var(--bg-secondary)', fontSize: 'var(--fs)', cursor: busy ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', fontWeight: 700,
          }}>↵</button>
        </div>
      </div>

      {/* ═══ CANVAS ═══ */}
      <div className="canvas">
        {/* Sidebar toggle */}
        <div className="sidebar-toggle" onClick={() => setPanelOpen(v => !v)} title="Toggle sidebar (Ctrl+B)">
          {panelOpen ? '◀' : '▶'}
        </div>

        {/* Map */}
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', display: view === 'map' ? 'block' : 'none' }} />

        {/* Flow */}
        {view === 'flow' && (
          <div style={{ width: '100%', height: '100%', background: 'var(--bg-primary)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 16, left: 20, fontSize: 'calc(var(--fs)*0.88)', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '.06em', zIndex: 10 }}>PROJECT FLOW</div>
            <svg style={{ width: '100%', height: '100%' }}>
              <g>
                {FLOW_CONNECTIONS.map(([fid, tid]) => {
                  const f = FLOW_NODES.find(n => n.id === fid), t = FLOW_NODES.find(n => n.id === tid)
                  if (!f || !t) return null
                  return <path key={fid + tid} d={`M${f.x} ${f.y} C${f.x + (t.x - f.x) * 0.4} ${f.y},${f.x + (t.x - f.x) * 0.6} ${t.y},${t.x} ${t.y}`} fill="none" stroke={f.color} strokeWidth="2" opacity="0.3" />
                })}
                {FLOW_NODES.map(n => (
                  <g key={n.id}>
                    <circle cx={n.x} cy={n.y} r="50" fill={n.color} opacity="0.06" />
                    <circle cx={n.x} cy={n.y} r="38" fill="var(--bg-secondary)" stroke={n.color} strokeWidth="2" />
                    <text x={n.x} y={n.y - 4} textAnchor="middle" fill="var(--text-primary)" fontSize="12" fontWeight="600" style={{ fontFamily: "'Source Serif 4',Georgia,serif" }}>{n.label}</text>
                    <text x={n.x} y={n.y + 12} textAnchor="middle" fill={n.color} fontSize="10" style={{ fontFamily: "'Source Serif 4',Georgia,serif" }} opacity="0.8">3 tasks</text>
                  </g>
                ))}
              </g>
            </svg>
          </div>
        )}

        {/* Map overlays */}
        {view === 'map' && (
          <>
            <div style={{ position: 'absolute', top: 14, left: panelOpen ? 20 : 44, zIndex: 1000, display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'none', transition: 'left .3s' }}>
              <span style={{ fontSize: 'calc(var(--fs)*0.82)', color: 'var(--text-primary)', fontWeight: 700, background: 'var(--glass)', padding: '5px 14px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>HUMANITARIAN CORRIDOR MAP</span>
              <span style={{ fontSize: 'calc(var(--fs)*0.62)', color: 'var(--danger)', background: 'var(--danger-bg)', padding: '3px 10px', borderRadius: 10, fontWeight: 700, backdropFilter: 'blur(4px)' }}>3 CRITICAL</span>
            </div>
            <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, display: 'flex', gap: 6, background: 'var(--glass-strong)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: '8px 14px', boxShadow: 'var(--shadow-md)', alignItems: 'center' }}>
              <span style={{ fontSize: 'calc(var(--fs)*0.62)', color: 'var(--text-muted)', fontWeight: 600, marginRight: 4, whiteSpace: 'nowrap' }}>TIMELINE</span>
              {sortedInc.map(inc => {
                const sv = SEVERITY[inc.s] || SEVERITY.medium
                return (
                  <div key={inc.id} title={`${inc.dt}: ${inc.ti}`} onClick={() => flyTo(inc.a, inc.o)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '3px 6px', borderRadius: 6, transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ fontSize: 'calc(var(--fs)*0.92)' }}>{ICON_MAP[inc.tp] || '⚠️'}</span>
                    <span style={{ fontSize: 'calc(var(--fs)*0.5)', color: sv.color, marginTop: 2, fontWeight: 600 }}>{inc.dt.slice(5)}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ═══ SETTINGS FAB ═══ */}
      <div ref={settingsRef} style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 9999 }}>
        <button onClick={() => setShowSettings(v => !v)} style={{
          width: 42, height: 42, borderRadius: 12, border: '1px solid var(--border-primary)',
          background: showSettings ? 'var(--text-primary)' : 'var(--bg-secondary)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-md)', transition: 'all .2s',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={showSettings ? 'var(--bg-secondary)' : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {showSettings && (
          <div style={{
            position: 'absolute', bottom: 52, left: 0, width: 340, maxHeight: '75vh', overflowY: 'auto',
            background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12,
            padding: 0, boxShadow: 'var(--shadow-lg)', animation: 'fadeIn .2s ease',
          }}>
            {/* Settings header */}
            <div style={{ padding: '16px 18px 0', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h3 style={{ fontSize: 'calc(var(--fs)*0.95)', fontWeight: 700 }}>⚙️ Settings</h3>
              <span style={{ fontSize: 'calc(var(--fs)*0.58)', color: 'var(--text-faint)', marginLeft: 'auto' }}>v2.0</span>
            </div>

            {/* Settings tabs */}
            <div style={{ display: 'flex', gap: 2, padding: '8px 18px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              {[
                { id: 'appearance', label: '🎨' },
                { id: 'map', label: '🗺️' },
                { id: 'ai', label: '🤖' },
                { id: 'about', label: 'ℹ️' },
              ].map(t => (
                <button key={t.id} onClick={() => setSettingsTab(t.id)} style={{
                  padding: '6px 14px', border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: 'calc(var(--fs)*0.9)', fontFamily: 'inherit', borderRadius: '6px 6px 0 0',
                  color: settingsTab === t.id ? 'var(--accent)' : 'var(--text-faint)',
                  borderBottom: settingsTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'all .15s',
                }}>{t.label}</button>
              ))}
            </div>

            <div style={{ padding: '16px 18px' }}>

              {/* ── APPEARANCE TAB ── */}
              {settingsTab === 'appearance' && (
                <>
                  {/* Theme toggle */}
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 'calc(var(--fs)*0.78)', fontWeight: 700, marginBottom: 10 }}>Theme</div>
                    <div style={{ display: 'flex', gap: 0, background: 'var(--surface-card)', borderRadius: 8, border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
                      {['light', 'dark'].map(t => (
                        <button key={t} onClick={() => { setTheme(t); if (t === 'dark' && baseLayerId === 'osm') setBaseLayerId('dark'); if (t === 'light' && baseLayerId === 'dark') setBaseLayerId('osm'); }} style={{
                          flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                          fontFamily: 'inherit', fontWeight: 600, fontSize: 'calc(var(--fs)*0.78)',
                          background: theme === t ? 'var(--accent)' : 'transparent',
                          color: theme === t ? '#FFF' : 'var(--text-muted)', transition: 'all .2s',
                        }}>{t === 'light' ? '☀️ Light' : '🌙 Dark'}</button>
                      ))}
                    </div>
                  </div>

                  {/* Font size */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 'calc(var(--fs)*0.72)', color: 'var(--text-secondary)', fontWeight: 600 }}>Font Size</span>
                      <span style={{ fontSize: 'calc(var(--fs)*0.72)', color: 'var(--text-muted)', fontWeight: 700, background: 'var(--surface-card)', padding: '2px 8px', borderRadius: 4 }}>{fs}px</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>A</span>
                      <input type="range" min="10" max="20" value={fs} onChange={e => setFs(Number(e.target.value))}
                        style={{ flex: 1, height: 4, WebkitAppearance: 'none', appearance: 'none', background: 'var(--border-primary)', borderRadius: 4, cursor: 'pointer', accentColor: 'var(--accent)' }} />
                      <span style={{ fontSize: 16, color: 'var(--text-secondary)', fontWeight: 700 }}>A</span>
                    </div>
                  </div>
                </>
              )}

              {/* ── MAP TAB ── */}
              {settingsTab === 'map' && (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 'calc(var(--fs)*0.78)', fontWeight: 700, marginBottom: 8 }}>Base Layer</div>
                    {layerOptions.map(b => (
                      <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 'calc(var(--fs)*0.75)', transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <input type="radio" name="bl" checked={baseLayerId === b.id} onChange={() => setBaseLayerId(b.id)}
                          style={{ accentColor: 'var(--accent)', margin: 0 }} />
                        <span><b>{b.name}</b></span>
                        <span style={{ color: 'var(--text-faint)', fontSize: 'calc(var(--fs)*0.6)', marginLeft: 'auto' }}>{b.desc}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                    <div style={{ fontSize: 'calc(var(--fs)*0.78)', fontWeight: 700, marginBottom: 8 }}>🛰️ Satellite Overlay</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 'calc(var(--fs)*0.75)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <input type="checkbox" checked={sentinel2} onChange={e => setSentinel2(e.target.checked)}
                        style={{ accentColor: 'var(--accent)', margin: 0 }} />
                      <span><b>Sentinel-2 L2A</b></span>
                      <span style={{ color: 'var(--text-faint)', fontSize: 'calc(var(--fs)*0.6)', marginLeft: 'auto' }}>Copernicus</span>
                    </label>
                    <div style={{ fontSize: 'calc(var(--fs)*0.55)', color: 'var(--text-faint)', padding: '4px 10px', lineHeight: 1.4 }}>
                      Zoom ≥ 6 required. Best at zoom 10+.
                    </div>
                  </div>
                </>
              )}

              {/* ── AI TAB ── */}
              {settingsTab === 'ai' && (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 'calc(var(--fs)*0.78)', fontWeight: 700, marginBottom: 8 }}>Claude API Key</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                        placeholder="sk-ant-..."
                        style={{
                          flex: 1, padding: '10px 12px', borderRadius: 8, fontSize: 'calc(var(--fs)*0.78)',
                          background: 'var(--surface-input)', border: '1px solid var(--border-input)',
                          color: 'var(--text-primary)', fontFamily: 'monospace', outline: 'none',
                        }} />
                      <button onClick={testApiKey} disabled={!apiKey || busy} style={{
                        padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-input)',
                        background: 'var(--surface-card)', color: 'var(--text-secondary)',
                        cursor: apiKey && !busy ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                        fontSize: 'calc(var(--fs)*0.72)', fontWeight: 600, opacity: apiKey ? 1 : 0.5,
                      }}>Test</button>
                    </div>
                    <div style={{ fontSize: 'calc(var(--fs)*0.55)', color: 'var(--text-faint)', marginTop: 6, lineHeight: 1.4 }}>
                      Stored locally in your browser. Never sent anywhere except Anthropic's API.
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 'calc(var(--fs)*0.78)', fontWeight: 700, marginBottom: 8 }}>Model</div>
                    <div style={{ display: 'flex', gap: 0, background: 'var(--surface-card)', borderRadius: 8, border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
                      {[
                        { id: 'claude-sonnet-4-20250514', label: 'Sonnet 4', desc: 'Balanced' },
                        { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', desc: 'Fast' },
                      ].map(m => (
                        <button key={m.id} onClick={() => setAiModel(m.id)} style={{
                          flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer',
                          fontFamily: 'inherit', fontWeight: 600, fontSize: 'calc(var(--fs)*0.72)',
                          background: aiModel === m.id ? 'var(--accent)' : 'transparent',
                          color: aiModel === m.id ? '#FFF' : 'var(--text-muted)', transition: 'all .2s',
                        }}>
                          <div>{m.label}</div>
                          <div style={{ fontSize: 'calc(var(--fs)*0.5)', opacity: 0.7 }}>{m.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: aiStatus === 'ready' ? '#3B7A57' : aiStatus === 'error' ? '#C73E1D' : '#8B7355' }} />
                    <span style={{ fontSize: 'calc(var(--fs)*0.72)', color: 'var(--text-muted)' }}>
                      {aiStatus === 'ready' ? 'Connected — AI assistant ready' : aiStatus === 'error' ? 'Error — check API key' : 'No API key configured'}
                    </span>
                  </div>
                </>
              )}

              {/* ── ABOUT TAB ── */}
              {settingsTab === 'about' && (
                <div style={{ fontSize: 'calc(var(--fs)*0.78)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  <div style={{ fontWeight: 700, fontSize: 'calc(var(--fs)*0.95)', marginBottom: 8 }}>Corridor Planner</div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
                    Map the crisis. Plan the corridor. Save lives.
                  </div>
                  <div>Version 2.0 • Phase 1</div>
                  <div>Built with React + Leaflet + Claude AI</div>
                  <div style={{ marginTop: 8, color: 'var(--text-faint)', fontSize: 'calc(var(--fs)*0.65)' }}>
                    Data: Copernicus Sentinel-2, OpenStreetMap, HOT, HDX, ACLED
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', fontSize: 'calc(var(--fs)*0.62)', color: 'var(--text-faint)' }}>
                    Keyboard shortcuts:<br />
                    Ctrl+B — Toggle sidebar<br />
                    Shift+Tab — Switch Map/Flow
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
