import { useState, useRef, useEffect, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ═══════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════
const COR = [
  { n: "Khartoum", a: 15.5, o: 32.5, t: "city", d: "Origin — Coordination HQ" },
  { n: "El-Obeid", a: 13.18, o: 30.22, t: "wp", d: "Logistics transfer point" },
  { n: "Kadugli", a: 11.0, o: 29.7, t: "wp", d: "South Kordofan — Security risk" },
  { n: "Abyei", a: 9.6, o: 28.4, t: "rz", d: "Disputed territory — High risk" },
  { n: "Aweil", a: 8.77, o: 27.39, t: "wp", d: "Northern Bahr el Ghazal" },
  { n: "Wau", a: 7.7, o: 28.0, t: "base", d: "Forward base — Depot & health center" },
  { n: "Rumbek", a: 6.8, o: 29.7, t: "wp", d: "Lakes region — Flood risk" },
  { n: "Bor", a: 6.2, o: 31.56, t: "wp", d: "Nile crossing" },
  { n: "Juba", a: 4.85, o: 31.58, t: "city", d: "Destination — Distribution center" },
]

const RZ = [
  { n: "South Kordofan Conflict", a: 11.5, o: 29.5, r: 80000, s: "high", d: "Active conflict zone. Armed groups, mined areas." },
  { n: "Abyei Disputed Zone", a: 9.6, o: 28.8, r: 70000, s: "critical", d: "Sovereignty dispute. Transit permits uncertain." },
  { n: "Sudd Marshland Flood", a: 7.0, o: 30.0, r: 100000, s: "medium", d: "Jun\u2013Oct impassable. Alt route required." },
  { n: "Jonglei Active Conflict", a: 8.0, o: 31.5, r: 120000, s: "critical", d: "SSPDF vs SPLA-iO. 280K+ displaced since Dec 2025." },
]

const INC = [
  { id: "i1", dt: "2026-02-03", a: 8.28, o: 31.60, tp: "bombardment", s: "critical", ti: "Lankien Hospital Warehouse Airstrike", d: "OCA (MSF Holland) hospital warehouse damaged by aerial bombardment.", ac: "SSPDF", og: "MSF Holland (OCA)" },
  { id: "i2", dt: "2026-02-03", a: 8.45, o: 31.75, tp: "looting", s: "high", ti: "Pieri PHCC Looted", d: "OCA Pieri Outreach PHCC looted.", ac: "Unknown", og: "MSF Holland (OCA)" },
  { id: "i3", dt: "2026-02-04", a: 8.60, o: 32.20, tp: "looting", s: "high", ti: "Walgak \u2014 Save the Children Office Burned", d: "Save the Children field office looted and burned.", ac: "Unknown", og: "Save the Children" },
  { id: "i4", dt: "2026-01-26", a: 8.0, o: 31.5, tp: "access-denial", s: "critical", ti: "Nyirol/Uror/Akobo Evacuation Order", d: "Gov forces ordered all civilians and humanitarian personnel to evacuate within 48h.", ac: "SSPDF", og: "Multiple" },
  { id: "i5", dt: "2026-02-08", a: 8.28, o: 31.60, tp: "control-change", s: "high", ti: "Lankien Control to SSPDF", d: "SSPDF declared control. New commissioner. UN/MSF advocating flights.", ac: "SSPDF", og: "UN/MSF/INGOs" },
  { id: "i6", dt: "2026-01-01", a: 7.7, o: 31.3, tp: "health", s: "high", ti: "Cholera Outbreak \u2014 Duk County", d: "~479 cholera cases since Jan 1. OCP (MSF France) responding.", ac: "N/A", og: "MSF France (OCP)" },
  { id: "i7", dt: "2025-12-15", a: 8.3, o: 31.8, tp: "displacement", s: "critical", ti: "280,000+ Displaced", d: "Over 280K displaced since late Dec. Majority hiding in bush.", ac: "SSPDF/SPLA-iO", og: "IOM/UNHCR" },
]

const AD = [
  { n: "Nyirol County", a: 8.5, o: 31.6, r: 45000 },
  { n: "Uror County", a: 8.1, o: 32.0, r: 50000 },
  { n: "Akobo County", a: 7.8, o: 33.0, r: 55000 },
]

const BAS = [
  { n: "Khartoum HQ", a: 15.5, o: 32.5, st: "Active", c: "Full operations" },
  { n: "Wau Forward Base", a: 7.7, o: 28.0, st: "Setup", c: "Depot + Clinic (60%)" },
  { n: "Juba Distribution", a: 4.85, o: 31.58, st: "Planning", c: "Distribution center" },
]

const ICO = { bombardment: "\uD83D\uDCA5", looting: "\uD83D\uDD25", "access-denial": "\uD83D\uDEAB", "control-change": "\u2690", health: "\uD83E\uDDA0", displacement: "\uD83D\uDC65" }
const SC = { critical: { m: "#C73E1D", l: "#C73E1D22" }, high: { m: "#D4820C", l: "#D4820C1A" }, medium: { m: "#A69220", l: "#A692201A" }, low: { m: "#3B7A57", l: "#3B7A571A" } }

const SH_INSTANCE = "2ac66286-c514-43e6-9f14-a15dc697315a"

const FLOW_NODES = [
  { id: "f1", l: "Planning", x: 300, y: 80, c: "#8B6914" },
  { id: "f2", l: "Base Setup", x: 140, y: 230, c: "#2E86AB" },
  { id: "f3", l: "Logistics", x: 460, y: 230, c: "#A23B72" },
  { id: "f4", l: "Risk Mgmt", x: 140, y: 400, c: "#C73E1D" },
  { id: "f5", l: "Local Coord", x: 460, y: 400, c: "#3B7A57" },
  { id: "f6", l: "Distribution", x: 300, y: 550, c: "#6A4C93" },
]
const FLOW_CONNS = [["f1","f2"],["f1","f3"],["f2","f4"],["f3","f5"],["f4","f6"],["f5","f6"],["f2","f5"]]

const AI_SYS = "You are a Humanitarian Aid Corridor Planning AI. Respond in English. Be concise but thorough.\nPROJECT: Sudan to South Sudan aid corridor (Khartoum to Juba, 1850km)\nINCIDENTS (Jonglei Briefing 2026-02-09): Lankien hospital airstrike (Feb 3, SSPDF, MSF Holland), Pieri PHCC looted (Feb 3), Walgak Save the Children burned (Feb 4), Evacuation order Nyirol/Uror/Akobo (Jan 26, SSPDF), Lankien control to SSPDF (Feb 8), Cholera 479 cases Duk County (MSF France), 280K+ displaced since Dec.\nACCESS DENIED: Nyirol, Uror, Akobo.\nBASES: Khartoum HQ (active), Wau (60% setup), Juba (planning).\nOCA=MSF Holland, OCP=MSF France.\nRISK ZONES: South Kordofan Conflict(high), Abyei Disputed(critical), Sudd Flood(medium), Jonglei Conflict(critical).\nData sources: HDX, ACLED, FloodScan, INFORM, IOM DTM, ReliefWeb."

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,300;8..60,400;8..60,500;8..60,600;8..60,700&display=swap');
:root { --fs: 13px; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; overflow: hidden; font-family: 'Source Serif 4', Georgia, serif; background: #F5F0E8; color: #3D2B1F; font-size: var(--fs); }
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: #F0EBE1; }
::-webkit-scrollbar-thumb { background: #C4B69C; border-radius: 10px; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
.leaflet-popup-content-wrapper { border-radius: 10px !important; font-family: 'Source Serif 4', Georgia, serif !important; box-shadow: 0 4px 15px rgba(61,43,31,.12) !important; }
.leaflet-popup-content { font-size: 13px !important; line-height: 1.6 !important; color: #3D2B1F !important; margin: 12px 14px !important; }
.leaflet-popup-content h3 { margin: 0 0 6px; font-size: 14px !important; }
.leaflet-popup-content .sv { display: inline-block; padding: 1px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
.leaflet-popup-content .mt { font-size: 11px; color: #8B7355; }
.dl { background: none !important; border: none !important; box-shadow: none !important; color: #C73E1D; font-weight: 700; font-size: 11px; font-family: 'Source Serif 4', Georgia, serif; text-align: center; white-space: nowrap; }
`

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView] = useState("map")
  const [fontSize, setFontSize] = useState(13)
  const [showSettings, setShowSettings] = useState(false)
  const [baseLayer, setBaseLayer] = useState("osm")
  const [sentinel2On, setSentinel2On] = useState(false)
  const [dataLayers, setDataLayers] = useState({ incidents: true, access: true, risks: true, corridor: true })
  const [messages, setMessages] = useState([
    { role: "a", text: "Humanitarian Corridor Planner is active.\n\nSudan \u2192 South Sudan corridor loaded with Jonglei field briefing data (2026-02-09). 7 incidents, 3 access-denied zones, and a cholera alert are plotted on the map.\n\nAsk me anything about the corridor, routes, risks, or logistics." }
  ])
  const [inputVal, setInputVal] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [chatHistory, setChatHistory] = useState([])

  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const baseLayerRef = useRef(null)
  const sentinelLayerRef = useRef(null)
  const dataLayerRefs = useRef({})
  const chatEndRef = useRef(null)
  const settingsRef = useRef(null)

  // Scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  // Font size
  useEffect(() => { document.documentElement.style.setProperty("--fs", fontSize + "px") }, [fontSize])

  // Close settings on outside click
  useEffect(() => {
    const handler = (e) => { if (settingsRef.current && !settingsRef.current.contains(e.target)) setShowSettings(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Shift+Tab
  useEffect(() => {
    const h = (e) => { if (e.shiftKey && e.key === "Tab") { e.preventDefault(); setView(v => v === "map" ? "flow" : "map") } }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [])

  // ─── INIT MAP ───
  useEffect(() => {
    if (mapInstanceRef.current) return
    const map = L.map(mapRef.current, { zoomControl: true }).setView([9.5, 30.5], 6)
    mapInstanceRef.current = map

    // Base layer
    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "\u00A9 OpenStreetMap", maxZoom: 19 })
    osm.addTo(map)
    baseLayerRef.current = osm

    // Data layers
    const groups = { corridor: L.layerGroup(), risks: L.layerGroup(), access: L.layerGroup(), incidents: L.layerGroup() }
    const basesGrp = L.layerGroup()

    // Corridor
    const cc = COR.map(p => [p.a, p.o])
    L.polyline(cc, { color: "#8B4513", weight: 3, opacity: 0.7, dashArray: "10 6" }).addTo(groups.corridor)
    L.polyline(cc, { color: "#8B4513", weight: 12, opacity: 0.08 }).addTo(groups.corridor)
    COR.forEach(p => {
      const c = p.t === "city" ? "#3D2B1F" : p.t === "base" ? "#2E86AB" : "#8B7355"
      const r = p.t === "city" ? 7 : p.t === "base" ? 6 : 4
      L.circleMarker([p.a, p.o], { radius: r, fillColor: c, color: "#FFF", weight: 2, fillOpacity: 0.9 })
        .bindPopup("<h3>" + p.n + "</h3><p>" + p.d + "</p><p class='mt'>\uD83D\uDCCD " + p.a.toFixed(2) + "\u00B0N, " + p.o.toFixed(2) + "\u00B0E</p>")
        .addTo(groups.corridor)
    })

    // Risks
    RZ.forEach(r => {
      const sv = SC[r.s] || SC.medium
      L.circle([r.a, r.o], { radius: r.r, fillColor: sv.m, color: sv.m, weight: 1.5, fillOpacity: 0.08, dashArray: "6 4" })
        .bindPopup("<h3>" + r.n + "</h3><span class='sv' style='background:" + sv.l + ";color:" + sv.m + "'>" + r.s.toUpperCase() + "</span><p>" + r.d + "</p>")
        .addTo(groups.risks)
    })

    // Access denied
    AD.forEach(z => {
      L.circle([z.a, z.o], { radius: z.r, fillColor: "#C73E1D", color: "#C73E1D", weight: 2, fillOpacity: 0.1, dashArray: "8 4" }).addTo(groups.access)
      L.circle([z.a, z.o], { radius: z.r * 0.7, fillColor: "#C73E1D", color: "#C73E1D", weight: 1, fillOpacity: 0.05 }).addTo(groups.access)
      L.marker([z.a, z.o], { icon: L.divIcon({ className: "dl", html: "\uD83D\uDEAB " + z.n + "<br><span style='font-size:0.8em;opacity:0.7'>NO ACCESS</span>", iconSize: [130, 35] }) }).addTo(groups.access)
    })

    // Incidents
    INC.forEach(i => {
      const sv = SC[i.s] || SC.medium
      const ic = ICO[i.tp] || "\u26A0\uFE0F"
      L.circleMarker([i.a, i.o], { radius: i.s === "critical" ? 10 : 8, fillColor: sv.m, color: "#FFF", weight: 2, fillOpacity: 0.85 })
        .bindPopup("<h3>" + ic + " " + i.ti + "</h3><span class='sv' style='background:" + sv.l + ";color:" + sv.m + "'>" + i.s.toUpperCase() + "</span> <span class='mt'>" + i.dt + "</span><p>" + i.d + "</p><p class='mt'>\u2694\uFE0F " + i.ac + " &nbsp; \uD83C\uDFE5 " + i.og + "</p>")
        .addTo(groups.incidents)
      if (i.s === "critical") L.circleMarker([i.a, i.o], { radius: 18, fillColor: sv.m, color: sv.m, weight: 1, fillOpacity: 0.12 }).addTo(groups.incidents)
    })

    // Bases
    BAS.forEach(b => {
      L.marker([b.a, b.o], { icon: L.divIcon({ className: "dl", html: "<span style='color:#2E86AB;font-size:16px'>\uD83C\uDFD5\uFE0F</span>", iconSize: [20, 20] }) })
        .bindPopup("<h3>\uD83C\uDFD5\uFE0F " + b.n + "</h3><p><b>Status:</b> " + b.st + "</p><p><b>Capacity:</b> " + b.c + "</p>")
        .addTo(basesGrp)
    })

    Object.values(groups).forEach(g => g.addTo(map))
    basesGrp.addTo(map)
    dataLayerRefs.current = groups
    map.fitBounds([[4.5, 26], [16, 34]], { padding: [30, 30] })
  }, [])

  // ─── BASE LAYER SWITCH ───
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current)

    const tiles = {
      osm: () => L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "\u00A9 OpenStreetMap", maxZoom: 19 }),
      hot: () => L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", { attribution: "\u00A9 OpenStreetMap, HOT", maxZoom: 19 }),
      esri: () => L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "\u00A9 Esri, Maxar", maxZoom: 19 }),
      topo: () => L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { attribution: "\u00A9 OpenTopoMap", maxZoom: 17 }),
    }

    const layer = (tiles[baseLayer] || tiles.osm)()
    layer.addTo(map)
    layer.bringToBack()
    baseLayerRef.current = layer
  }, [baseLayer])

  // ─── SENTINEL-2 OVERLAY ───
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    if (sentinelLayerRef.current) { map.removeLayer(sentinelLayerRef.current); sentinelLayerRef.current = null }
    if (sentinel2On) {
      const s2 = L.tileLayer.wms("https://sh.dataspace.copernicus.eu/ogc/wms/" + SH_INSTANCE, {
        layers: "TRUE-COLOR", tileSize: 512, attribution: "\u00A9 Copernicus Sentinel",
        format: "image/png", transparent: true, maxcc: 30, minZoom: 6, maxZoom: 16,
        time: "2025-10-01/2026-02-12"
      })
      s2.addTo(map)
      sentinelLayerRef.current = s2
    }
  }, [sentinel2On])

  // ─── DATA LAYER TOGGLES ───
  const toggleDataLayer = useCallback((key) => {
    setDataLayers(prev => {
      const next = { ...prev, [key]: !prev[key] }
      const map = mapInstanceRef.current
      const grp = dataLayerRefs.current[key]
      if (map && grp) {
        if (next[key]) grp.addTo(map)
        else map.removeLayer(grp)
      }
      return next
    })
  }, [])

  // ─── VIEW SWITCH ───
  useEffect(() => {
    if (view === "map" && mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current.invalidateSize(), 100)
    }
  }, [view])

  // ─── AI CHAT ───
  const sendMessage = async () => {
    const msg = inputVal.trim()
    if (!msg || isLoading) return
    setMessages(prev => [...prev, { role: "u", text: msg }])
    setInputVal("")
    setIsLoading(true)
    const newHistory = [...chatHistory, { role: "user", content: msg }]
    setChatHistory(newHistory)

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system: AI_SYS, messages: newHistory.slice(-12) }),
      })
      const data = await res.json()
      let text = ""
      if (data.content) data.content.forEach(b => { if (b.type === "text") text += b.text })
      if (!text) text = "No response received."
      setMessages(prev => [...prev, { role: "a", text }])
      setChatHistory(prev => [...prev, { role: "assistant", content: text }])
    } catch (err) {
      setMessages(prev => [...prev, { role: "a", text: "Connection error: " + err.message + "\n\nYou can continue working offline." }])
    }
    setIsLoading(false)
  }

  const flyTo = (lat, lon, zoom) => { mapInstanceRef.current?.setView([lat, lon], zoom || 9) }

  // ─── FLOW RENDER ───
  const renderFlow = () => {
    const fn = id => FLOW_NODES.find(n => n.id === id)
    return (
      <svg style={{ width: "100%", height: "100%" }}>
        <g>
          {FLOW_CONNS.map(([fid, tid]) => {
            const f = fn(fid), t = fn(tid)
            if (!f || !t) return null
            const cx1 = f.x + (t.x - f.x) * 0.4, cy1 = f.y, cx2 = f.x + (t.x - f.x) * 0.6, cy2 = t.y
            return <path key={fid + tid} d={"M" + f.x + " " + f.y + " C" + cx1 + " " + cy1 + "," + cx2 + " " + cy2 + "," + t.x + " " + t.y} fill="none" stroke={f.c} strokeWidth="2" opacity="0.3" />
          })}
          {FLOW_NODES.map(n => (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r="50" fill={n.c} opacity="0.06" />
              <circle cx={n.x} cy={n.y} r="38" fill="#FAF7F2" stroke={n.c} strokeWidth="2" />
              <text x={n.x} y={n.y - 4} textAnchor="middle" fill="#3D2B1F" fontSize="12" fontWeight="600" fontFamily="'Source Serif 4',Georgia,serif">{n.l}</text>
              <text x={n.x} y={n.y + 12} textAnchor="middle" fill={n.c} fontSize="10" fontFamily="'Source Serif 4',Georgia,serif" opacity="0.8">3 tasks</text>
            </g>
          ))}
        </g>
      </svg>
    )
  }

  const sortedInc = [...INC].sort((a, b) => a.dt.localeCompare(b.dt))
  const baseLayers = [
    { id: "osm", name: "OpenStreetMap", icon: "\uD83D\uDDFA\uFE0F", desc: "Standard" },
    { id: "hot", name: "HOT Humanitarian", icon: "\u2764\uFE0F", desc: "Humanitarian" },
    { id: "esri", name: "ESRI Satellite", icon: "\uD83D\uDEF0\uFE0F", desc: "High-res" },
    { id: "topo", name: "OpenTopoMap", icon: "\u26F0\uFE0F", desc: "Topographic" },
  ]

  const esc = t => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")

  // ═══════════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div style={{ display: "flex", height: "100vh", width: "100vw", flexDirection: window.innerWidth <= 860 ? "column" : "row" }}>

        {/* ═══ PANEL ═══ */}
        <div style={{ width: window.innerWidth <= 860 ? "100%" : 380, minWidth: window.innerWidth <= 860 ? "unset" : 380, maxHeight: window.innerWidth <= 860 ? "55vh" : "unset", display: "flex", flexDirection: "column", background: "#FAF7F2", borderRight: window.innerWidth > 860 ? "1px solid #E0D5C4" : "none", borderBottom: window.innerWidth <= 860 ? "1px solid #E0D5C4" : "none", zIndex: 100 }}>

          {/* Header */}
          <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid #E8DFD1" }}>
            <h1 style={{ fontSize: "calc(var(--fs)*1.05)", fontWeight: 700, letterSpacing: ".04em", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#C73E1D", boxShadow: "0 0 8px #C73E1D66", display: "inline-block" }} />
              CORRIDOR PLANNER
              <span style={{ fontSize: "calc(var(--fs)*0.58)", color: "#C73E1D", background: "#C73E1D14", padding: "2px 8px", borderRadius: 3, fontWeight: 700, marginLeft: "auto" }}>AI ACTIVE</span>
            </h1>
            <div style={{ fontSize: "calc(var(--fs)*0.72)", color: "#8B7355", marginTop: 4 }}>Sudan → South Sudan • Jonglei Briefing 2026-02-09</div>
          </div>

          {/* View toggle */}
          <div style={{ display: "flex", padding: "10px 18px", gap: 8, borderBottom: "1px solid #E8DFD1" }}>
            {["map", "flow"].map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: "calc(var(--fs)*0.82)", fontWeight: 600, fontFamily: "inherit", letterSpacing: ".04em",
                background: view === v ? (v === "map" ? "#3D2B1F" : "#8B6914") : "#F0EBE1",
                color: view === v ? "#FAF7F2" : "#8B7355", transition: "all .2s",
              }}>{v === "map" ? "\uD83D\uDDFA\uFE0F MAP" : "\uD83D\uDD00 FLOW"}</button>
            ))}
            <span style={{ fontSize: "calc(var(--fs)*0.62)", color: "#B8A88A", display: "flex", alignItems: "center", paddingLeft: 4 }}>{"\u21E7"}Tab</span>
          </div>

          {/* Data layer toggles */}
          {view === "map" && (
            <div style={{ display: "flex", gap: 5, padding: "10px 18px", borderBottom: "1px solid #E8DFD1", flexWrap: "wrap" }}>
              {[
                { k: "incidents", label: "Incidents", c: "#C73E1D" },
                { k: "access", label: "No-Access", c: "#9B2915" },
                { k: "risks", label: "Risk Zones", c: "#D4820C" },
                { k: "corridor", label: "Corridor", c: "#8B4513" },
              ].map(l => (
                <button key={l.k} onClick={() => toggleDataLayer(l.k)} style={{
                  padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: "calc(var(--fs)*0.68)",
                  fontFamily: "inherit", fontWeight: 600, transition: "all .2s",
                  background: dataLayers[l.k] ? l.c + "14" : "#F0EBE1",
                  color: dataLayers[l.k] ? l.c : "#B8A88A",
                  border: "1px solid " + (dataLayers[l.k] ? l.c + "44" : "#E0D5C4"),
                }}>{dataLayers[l.k] ? "\u25CF" : "\u25CB"} {l.label}</button>
              ))}
            </div>
          )}

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, padding: "10px 18px", borderBottom: "1px solid #E8DFD1" }}>
            {[
              { v: "7", l: "Incidents", c: "#C73E1D" },
              { v: "3", l: "No-Access", c: "#9B2915" },
              { v: "280K+", l: "IDPs", c: "#D4820C" },
              { v: "479", l: "Cholera", c: "#8B6914" },
            ].map(s => (
              <div key={s.l} style={{ padding: "8px 4px", borderRadius: 6, textAlign: "center", background: "#F0EBE1", border: "1px solid #E0D5C4" }}>
                <div style={{ fontSize: "calc(var(--fs)*1.2)", fontWeight: 700, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: "calc(var(--fs)*0.58)", color: "#8B7355", marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Chat */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ animation: "fadeIn .3s ease", maxWidth: "94%", alignSelf: msg.role === "u" ? "flex-end" : "flex-start" }}>
                {msg.role === "a" && <div style={{ fontSize: "calc(var(--fs)*0.62)", color: "#B8A88A", marginBottom: 3, paddingLeft: 4 }}>{"\uD83E\uDD16"} AI Assistant</div>}
                <div style={{
                  padding: "12px 14px", borderRadius: 12, fontSize: "calc(var(--fs)*0.88)", lineHeight: 1.75,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                  ...(msg.role === "u"
                    ? { background: "#3D2B1F", color: "#FAF7F2", borderBottomRightRadius: 3 }
                    : { background: "#FFF", border: "1px solid #E0D5C4", color: "#3D2B1F", borderBottomLeftRadius: 3, boxShadow: "0 1px 3px rgba(61,43,31,.06)" }),
                }}>{msg.text}</div>
              </div>
            ))}
            {isLoading && (
              <div style={{ animation: "fadeIn .2s ease", alignSelf: "flex-start", maxWidth: "94%" }}>
                <div style={{ fontSize: "calc(var(--fs)*0.62)", color: "#B8A88A", marginBottom: 3, paddingLeft: 4 }}>{"\uD83E\uDD16"} AI Assistant</div>
                <div style={{ padding: "12px 14px", borderRadius: 12, fontSize: "calc(var(--fs)*0.88)", background: "#FFF", border: "1px solid #E0D5C4", borderBottomLeftRadius: 3 }}>
                  <span style={{ animation: "blink 1.2s infinite", color: "#8B7355" }}>Thinking...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick prompts */}
          <div style={{ padding: "8px 18px 0", display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["Jonglei situation?", "Route to Lankien?", "Cholera measures", "Alt route"].map(q => (
              <button key={q} onClick={() => setInputVal(q)} style={{
                background: "#F0EBE1", border: "1px solid #DDD5C5", color: "#6B5B45",
                fontSize: "calc(var(--fs)*0.62)", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
              }}>{q}</button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: "12px 18px 16px", display: "flex", gap: 8 }}>
            <input
              value={inputVal} onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder={isLoading ? "AI is responding..." : "Ask about the corridor..."}
              disabled={isLoading}
              style={{ flex: 1, padding: "12px 14px", borderRadius: 10, fontSize: "calc(var(--fs)*0.88)", background: "#FFF", border: "1px solid #DDD5C5", color: "#3D2B1F", fontFamily: "inherit", outline: "none", opacity: isLoading ? 0.6 : 1 }}
            />
            <button onClick={sendMessage} disabled={isLoading} style={{
              padding: "12px 18px", borderRadius: 10, border: "none", background: isLoading ? "#C4B69C" : "#3D2B1F",
              color: "#FAF7F2", fontSize: "var(--fs)", cursor: isLoading ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: 700,
            }}>{"\u21B5"}</button>
          </div>
        </div>

        {/* ═══ CANVAS ═══ */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: window.innerWidth <= 860 ? "45vh" : "unset" }}>

          {/* Map */}
          <div ref={mapRef} style={{ width: "100%", height: "100%", display: view === "map" ? "block" : "none" }} />

          {/* Flow */}
          {view === "flow" && (
            <div style={{ width: "100%", height: "100%", background: "#F5F0E8", position: "relative" }}>
              <div style={{ position: "absolute", top: 16, left: 20, fontSize: "calc(var(--fs)*0.88)", color: "#8B7355", fontWeight: 600, letterSpacing: ".06em", zIndex: 10 }}>PROJECT FLOW</div>
              {renderFlow()}
            </div>
          )}

          {/* Map header */}
          {view === "map" && (
            <div style={{ position: "absolute", top: 14, left: 60, zIndex: 1000, display: "flex", gap: 8, alignItems: "center", pointerEvents: "none" }}>
              <span style={{ fontSize: "calc(var(--fs)*0.82)", color: "#3D2B1F", fontWeight: 700, background: "rgba(250,247,242,.92)", padding: "5px 14px", borderRadius: 6, backdropFilter: "blur(4px)" }}>HUMANITARIAN CORRIDOR MAP</span>
              <span style={{ fontSize: "calc(var(--fs)*0.62)", color: "#C73E1D", background: "rgba(199,62,29,.08)", padding: "3px 10px", borderRadius: 10, fontWeight: 700, backdropFilter: "blur(4px)" }}>3 CRITICAL</span>
            </div>
          )}

          {/* Timeline */}
          {view === "map" && (
            <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", zIndex: 1000, display: "flex", gap: 6, background: "rgba(250,247,242,.95)", border: "1px solid #E0D5C4", borderRadius: 10, padding: "8px 14px", boxShadow: "0 2px 8px rgba(61,43,31,.1)", alignItems: "center" }}>
              <span style={{ fontSize: "calc(var(--fs)*0.62)", color: "#8B7355", fontWeight: 600, marginRight: 4, whiteSpace: "nowrap" }}>TIMELINE</span>
              {sortedInc.map(inc => {
                const sv = SC[inc.s] || SC.medium
                return (
                  <div key={inc.id} title={inc.dt + ": " + inc.ti} onClick={() => flyTo(inc.a, inc.o)}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", padding: "3px 6px", borderRadius: 6, transition: "background .15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#F0EBE1"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ fontSize: "calc(var(--fs)*0.92)" }}>{ICO[inc.tp] || "\u26A0\uFE0F"}</span>
                    <span style={{ fontSize: "calc(var(--fs)*0.5)", color: sv.m, marginTop: 2, fontWeight: 600 }}>{inc.dt.slice(5)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ SETTINGS ═══ */}
      <div ref={settingsRef} style={{ position: "fixed", bottom: window.innerWidth <= 860 ? "auto" : 16, top: window.innerWidth <= 860 ? 12 : "auto", left: 16, zIndex: 9999 }}>
        <button onClick={() => setShowSettings(v => !v)} style={{
          width: 42, height: 42, borderRadius: 12, border: "1px solid #E0D5C4",
          background: showSettings ? "#3D2B1F" : "#FAF7F2", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 10px rgba(61,43,31,.12)",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={showSettings ? "#FAF7F2" : "#8B7355"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {showSettings && (
          <div style={{
            position: "absolute", bottom: window.innerWidth <= 860 ? "auto" : 52, top: window.innerWidth <= 860 ? 52 : "auto",
            left: 0, width: 300, maxHeight: "70vh", overflowY: "auto",
            background: "#FAF7F2", border: "1px solid #E0D5C4", borderRadius: 12,
            padding: "16px 18px", boxShadow: "0 4px 20px rgba(61,43,31,.15)", animation: "fadeIn .2s ease",
          }}>
            <h3 style={{ fontSize: "calc(var(--fs)*0.88)", fontWeight: 700, marginBottom: 14 }}>{"\u2699\uFE0F"} Settings</h3>

            {/* Font Size */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: "calc(var(--fs)*0.78)", fontWeight: 700, color: "#3D2B1F", marginBottom: 8 }}>Appearance</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontSize: "calc(var(--fs)*0.72)", color: "#6B5B45", fontWeight: 600 }}>Font Size</span>
                <span style={{ fontSize: "calc(var(--fs)*0.72)", color: "#8B7355", fontWeight: 700, background: "#F0EBE1", padding: "2px 8px", borderRadius: 4 }}>{fontSize}px</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <span style={{ fontSize: 10, color: "#B8A88A" }}>A</span>
                <input type="range" min="10" max="20" value={fontSize} onChange={e => setFontSize(Number(e.target.value))}
                  style={{ flex: 1, height: 4, appearance: "none", WebkitAppearance: "none", background: "#E0D5C4", borderRadius: 4, cursor: "pointer", accentColor: "#8B6914" }} />
                <span style={{ fontSize: 16, color: "#6B5B45", fontWeight: 700 }}>A</span>
              </div>
            </div>

            {/* Base Layer */}
            <div style={{ borderTop: "1px solid #E8DFD1", paddingTop: 12, marginBottom: 14 }}>
              <div style={{ fontSize: "calc(var(--fs)*0.78)", fontWeight: 700, color: "#3D2B1F", marginBottom: 8 }}>{"\uD83D\uDDFA\uFE0F"} Map Base Layer</div>
              {baseLayers.map(b => (
                <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: "calc(var(--fs)*0.75)", transition: "background .15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F0EBE1"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <input type="radio" name="bl" checked={baseLayer === b.id} onChange={() => setBaseLayer(b.id)}
                    style={{ accentColor: "#8B6914", margin: 0 }} />
                  <span>{b.icon} <b>{b.name}</b></span>
                  <span style={{ color: "#B8A88A", fontSize: "calc(var(--fs)*0.6)", marginLeft: "auto" }}>{b.desc}</span>
                </label>
              ))}
            </div>

            {/* Satellite Overlay */}
            <div style={{ borderTop: "1px solid #E8DFD1", paddingTop: 12 }}>
              <div style={{ fontSize: "calc(var(--fs)*0.78)", fontWeight: 700, color: "#3D2B1F", marginBottom: 8 }}>{"\uD83D\uDEF0\uFE0F"} Satellite Overlay</div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: "calc(var(--fs)*0.75)", transition: "background .15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#F0EBE1"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <input type="checkbox" checked={sentinel2On} onChange={e => setSentinel2On(e.target.checked)}
                  style={{ accentColor: "#8B6914", margin: 0 }} />
                <span>{"\uD83D\uDEF0\uFE0F"} <b>Sentinel-2 L2A</b></span>
                <span style={{ color: "#B8A88A", fontSize: "calc(var(--fs)*0.6)", marginLeft: "auto" }}>Copernicus</span>
              </label>
              <div style={{ fontSize: "calc(var(--fs)*0.58)", color: "#B8A88A", marginTop: 6, padding: "0 10px", lineHeight: 1.4 }}>
                Sentinel-2 requires zoom {"\u2265"} 6. Best at zoom 10+. Recent cloud-free imagery.
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
