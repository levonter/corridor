// Sudan-South Sudan Corridor — Default Event Data

export const DEFAULT_EVENT = {
  id: "evt_sudan_ss",
  name: "Sudan → South Sudan Corridor",
  status: "active",
  severity: "critical",
  brief: "Khartoum to Juba humanitarian corridor (1,850km). Jonglei state facing acute crisis: 280K+ displaced, 3 counties access-denied, cholera outbreak in Duk County. SSPDF military operations ongoing.",
  region: { center: [9.5, 30.5], zoom: 6, bounds: [[4.5, 26], [16, 34]] },
  createdAt: "2026-02-09",
  updatedAt: "2026-02-16",
}

export const CORRIDOR = [
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

export const RISK_ZONES = [
  { n: "South Kordofan Conflict", a: 11.5, o: 29.5, r: 80000, s: "high", d: "Active conflict zone. Armed groups, mined areas." },
  { n: "Abyei Disputed Zone", a: 9.6, o: 28.8, r: 70000, s: "critical", d: "Sovereignty dispute. Transit permits uncertain." },
  { n: "Sudd Marshland Flood", a: 7.0, o: 30.0, r: 100000, s: "medium", d: "Jun–Oct impassable. Alt route required." },
  { n: "Jonglei Active Conflict", a: 8.0, o: 31.5, r: 120000, s: "critical", d: "SSPDF vs SPLA-iO. 280K+ displaced since Dec 2025." },
]

export const INCIDENTS = [
  { id: "i1", dt: "2026-02-03", a: 8.28, o: 31.60, tp: "bombardment", s: "critical", ti: "Lankien Hospital Warehouse Airstrike", d: "OCA (MSF Holland) hospital warehouse damaged by aerial bombardment.", ac: "SSPDF", og: "MSF Holland (OCA)" },
  { id: "i2", dt: "2026-02-03", a: 8.45, o: 31.75, tp: "looting", s: "high", ti: "Pieri PHCC Looted", d: "OCA Pieri Outreach PHCC looted.", ac: "Unknown", og: "MSF Holland (OCA)" },
  { id: "i3", dt: "2026-02-04", a: 8.60, o: 32.20, tp: "looting", s: "high", ti: "Walgak — Save the Children Office Burned", d: "Save the Children field office looted and burned.", ac: "Unknown", og: "Save the Children" },
  { id: "i4", dt: "2026-01-26", a: 8.0, o: 31.5, tp: "access-denial", s: "critical", ti: "Nyirol/Uror/Akobo Evacuation Order", d: "Gov forces ordered all civilians and humanitarian personnel to evacuate within 48h.", ac: "SSPDF", og: "Multiple" },
  { id: "i5", dt: "2026-02-08", a: 8.28, o: 31.60, tp: "control-change", s: "high", ti: "Lankien Control to SSPDF", d: "SSPDF declared control. New commissioner. UN/MSF advocating flights.", ac: "SSPDF", og: "UN/MSF/INGOs" },
  { id: "i6", dt: "2026-01-01", a: 7.7, o: 31.3, tp: "health", s: "high", ti: "Cholera Outbreak — Duk County", d: "~479 cholera cases since Jan 1. OCP (MSF France) responding.", ac: "N/A", og: "MSF France (OCP)" },
  { id: "i7", dt: "2025-12-15", a: 8.3, o: 31.8, tp: "displacement", s: "critical", ti: "280,000+ Displaced", d: "Over 280K displaced since late Dec. Majority hiding in bush.", ac: "SSPDF/SPLA-iO", og: "IOM/UNHCR" },
]

export const ACCESS_DENIED = [
  { n: "Nyirol County", a: 8.5, o: 31.6, r: 45000 },
  { n: "Uror County", a: 8.1, o: 32.0, r: 50000 },
  { n: "Akobo County", a: 7.8, o: 33.0, r: 55000 },
]

export const BASES = [
  { n: "Khartoum HQ", a: 15.5, o: 32.5, st: "Active", c: "Full operations" },
  { n: "Wau Forward Base", a: 7.7, o: 28.0, st: "Setup", c: "Depot + Clinic (60%)" },
  { n: "Juba Distribution", a: 4.85, o: 31.58, st: "Planning", c: "Distribution center" },
]

export const ICON_MAP = {
  bombardment: "💥", looting: "🔥", "access-denial": "🚫",
  "control-change": "⚑", health: "🦠", displacement: "👥"
}

export const SEVERITY = {
  critical: { color: "#C73E1D", bg: "#C73E1D22" },
  high: { color: "#D4820C", bg: "#D4820C1A" },
  medium: { color: "#A69220", bg: "#A692201A" },
  low: { color: "#3B7A57", bg: "#3B7A571A" },
}

export const STATS = [
  { value: "7", label: "Incidents", color: "#C73E1D" },
  { value: "3", label: "No-Access", color: "#9B2915" },
  { value: "280K+", label: "IDPs", color: "#D4820C" },
  { value: "479", label: "Cholera", color: "#8B6914" },
]

export const FLOW_NODES = [
  { id: "f1", label: "Planning", x: 300, y: 80, color: "#8B6914" },
  { id: "f2", label: "Base Setup", x: 140, y: 230, color: "#2E86AB" },
  { id: "f3", label: "Logistics", x: 460, y: 230, color: "#A23B72" },
  { id: "f4", label: "Risk Mgmt", x: 140, y: 400, color: "#C73E1D" },
  { id: "f5", label: "Local Coord", x: 460, y: 400, color: "#3B7A57" },
  { id: "f6", label: "Distribution", x: 300, y: 550, color: "#6A4C93" },
]

export const FLOW_CONNECTIONS = [
  ["f1","f2"],["f1","f3"],["f2","f4"],["f3","f5"],["f4","f6"],["f5","f6"],["f2","f5"]
]

export const BASE_LAYERS = [
  { id: "osm", name: "OpenStreetMap", desc: "Standard" },
  { id: "hot", name: "HOT Humanitarian", desc: "Humanitarian" },
  { id: "esri", name: "ESRI Satellite", desc: "High-res" },
  { id: "topo", name: "OpenTopoMap", desc: "Topographic" },
]

// Dark-friendly base layers
export const DARK_BASE_LAYERS = [
  { id: "dark", name: "CartoDB Dark", desc: "Dark mode" },
  { id: "hot", name: "HOT Humanitarian", desc: "Humanitarian" },
  { id: "esri", name: "ESRI Satellite", desc: "High-res" },
  { id: "topo", name: "OpenTopoMap", desc: "Topographic" },
]

export const COPERNICUS_INSTANCE = "2ac66286-c514-43e6-9f14-a15dc697315a"

export const QUICK_PROMPTS = [
  "Jonglei situation?",
  "Route to Lankien?",
  "Cholera measures",
  "Alt route",
]

export function buildSystemPrompt(event) {
  return `You are a Humanitarian Aid Corridor Planning AI. Respond in English. Be concise but thorough.
PROJECT: ${event?.name || 'Sudan to South Sudan aid corridor'} (Khartoum to Juba, 1850km)
INCIDENTS (Jonglei Briefing 2026-02-09): Lankien hospital airstrike (Feb 3, SSPDF, MSF Holland), Pieri PHCC looted (Feb 3), Walgak Save the Children burned (Feb 4), Evacuation order Nyirol/Uror/Akobo (Jan 26, SSPDF), Lankien control to SSPDF (Feb 8), Cholera 479 cases Duk County (MSF France), 280K+ displaced since Dec.
ACCESS DENIED: Nyirol, Uror, Akobo.
BASES: Khartoum HQ (active), Wau (60% setup), Juba (planning).
OCA=MSF Holland, OCP=MSF France.
RISK ZONES: South Kordofan Conflict(high), Abyei Disputed(critical), Sudd Flood(medium), Jonglei Conflict(critical).
Data sources: HDX, ACLED, FloodScan, INFORM, IOM DTM, ReliefWeb.`
}
