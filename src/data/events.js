export const ICON_MAP = { bombardment:"💥", looting:"🔥", "access-denial":"🚫", "control-change":"⚑", health:"🦠", displacement:"👥" }
export const SEVERITY = { critical:{color:"#C73E1D",bg:"#C73E1D22"}, high:{color:"#D4820C",bg:"#D4820C1A"}, medium:{color:"#A69220",bg:"#A692201A"}, low:{color:"#3B7A57",bg:"#3B7A571A"} }
export const FLOW_NODES = [{id:"f1",label:"Planning",x:300,y:80,color:"#8B6914"},{id:"f2",label:"Base Setup",x:140,y:230,color:"#2E86AB"},{id:"f3",label:"Logistics",x:460,y:230,color:"#A23B72"},{id:"f4",label:"Risk Mgmt",x:140,y:400,color:"#C73E1D"},{id:"f5",label:"Local Coord",x:460,y:400,color:"#3B7A57"},{id:"f6",label:"Distribution",x:300,y:550,color:"#6A4C93"}]
export const FLOW_CONNECTIONS = [["f1","f2"],["f1","f3"],["f2","f4"],["f3","f5"],["f4","f6"],["f5","f6"],["f2","f5"]]
export const BASE_LAYERS = [{id:"osm",name:"OpenStreetMap",desc:"Standard"},{id:"hot",name:"HOT Humanitarian",desc:"Humanitarian"},{id:"esri",name:"ESRI Satellite",desc:"High-res"},{id:"topo",name:"OpenTopoMap",desc:"Topographic"}]
export const COPERNICUS_INSTANCE = "2ac66286-c514-43e6-9f14-a15dc697315a"

export function createEvent(ov={}) {
  return { id:'evt_'+Date.now(), name:'New Event', status:'active', severity:'medium', brief:'', description:'',
    region:{center:[9.5,30.5],zoom:6,bounds:[[4.5,26],[16,34]]}, corridor:[], riskZones:[], incidents:[], accessDenied:[], bases:[],
    notebook:[], createdAt:new Date().toISOString().slice(0,10), updatedAt:new Date().toISOString().slice(0,10), ...ov }
}

export const SUDAN_EVENT = createEvent({
  id:'evt_sudan_ss', name:'Sudan → South Sudan Corridor', status:'active', severity:'critical',
  brief:'Khartoum to Juba corridor (1,850km). Jonglei: 280K+ displaced, 3 counties access-denied, cholera in Duk County.',
  description:'Humanitarian corridor through active conflict zones. SSPDF military operations ongoing in Jonglei state. Multiple MSF facilities attacked. Cholera outbreak requires immediate health response.',
  region:{center:[9.5,30.5],zoom:6,bounds:[[4.5,26],[16,34]]},
  corridor:[
    {n:"Khartoum",a:15.5,o:32.5,t:"city",d:"Origin — Coordination HQ"},
    {n:"El-Obeid",a:13.18,o:30.22,t:"wp",d:"Logistics transfer point"},
    {n:"Kadugli",a:11.0,o:29.7,t:"wp",d:"South Kordofan — Security risk"},
    {n:"Abyei",a:9.6,o:28.4,t:"rz",d:"Disputed territory — High risk"},
    {n:"Aweil",a:8.77,o:27.39,t:"wp",d:"Northern Bahr el Ghazal"},
    {n:"Wau",a:7.7,o:28.0,t:"base",d:"Forward base — Depot & health center"},
    {n:"Rumbek",a:6.8,o:29.7,t:"wp",d:"Lakes region — Flood risk"},
    {n:"Bor",a:6.2,o:31.56,t:"wp",d:"Nile crossing"},
    {n:"Juba",a:4.85,o:31.58,t:"city",d:"Destination — Distribution center"},
  ],
  riskZones:[
    {n:"South Kordofan Conflict",a:11.5,o:29.5,r:80000,s:"high",d:"Active conflict zone."},
    {n:"Abyei Disputed Zone",a:9.6,o:28.8,r:70000,s:"critical",d:"Sovereignty dispute."},
    {n:"Sudd Marshland Flood",a:7.0,o:30.0,r:100000,s:"medium",d:"Jun–Oct impassable."},
    {n:"Jonglei Active Conflict",a:8.0,o:31.5,r:120000,s:"critical",d:"280K+ displaced since Dec 2025."},
  ],
  incidents:[
    {id:"i1",dt:"2026-02-03",a:8.28,o:31.60,tp:"bombardment",s:"critical",ti:"Lankien Hospital Airstrike",d:"OCA hospital warehouse damaged by aerial bombardment.",ac:"SSPDF",og:"MSF Holland (OCA)"},
    {id:"i2",dt:"2026-02-03",a:8.45,o:31.75,tp:"looting",s:"high",ti:"Pieri PHCC Looted",d:"OCA Pieri Outreach PHCC looted.",ac:"Unknown",og:"MSF Holland (OCA)"},
    {id:"i3",dt:"2026-02-04",a:8.60,o:32.20,tp:"looting",s:"high",ti:"Walgak Office Burned",d:"Save the Children office looted and burned.",ac:"Unknown",og:"Save the Children"},
    {id:"i4",dt:"2026-01-26",a:8.0,o:31.5,tp:"access-denial",s:"critical",ti:"Evacuation Order",d:"Nyirol/Uror/Akobo evacuation order within 48h.",ac:"SSPDF",og:"Multiple"},
    {id:"i5",dt:"2026-02-08",a:8.28,o:31.60,tp:"control-change",s:"high",ti:"Lankien Control to SSPDF",d:"SSPDF declared control.",ac:"SSPDF",og:"UN/MSF/INGOs"},
    {id:"i6",dt:"2026-01-01",a:7.7,o:31.3,tp:"health",s:"high",ti:"Cholera — Duk County",d:"~479 cholera cases. MSF France responding.",ac:"N/A",og:"MSF France (OCP)"},
    {id:"i7",dt:"2025-12-15",a:8.3,o:31.8,tp:"displacement",s:"critical",ti:"280K+ Displaced",d:"Over 280K displaced. Majority hiding in bush.",ac:"SSPDF/SPLA-iO",og:"IOM/UNHCR"},
  ],
  accessDenied:[{n:"Nyirol County",a:8.5,o:31.6,r:45000},{n:"Uror County",a:8.1,o:32.0,r:50000},{n:"Akobo County",a:7.8,o:33.0,r:55000}],
  bases:[{n:"Khartoum HQ",a:15.5,o:32.5,st:"Active",c:"Full operations"},{n:"Wau Forward Base",a:7.7,o:28.0,st:"Setup",c:"Depot + Clinic (60%)"},{n:"Juba Distribution",a:4.85,o:31.58,st:"Planning",c:"Distribution center"}],
  notebook:[{id:'n1',author:'System',type:'update',text:'Event created from Jonglei field briefing data.',ts:'2026-02-09T10:00:00Z'}],
  createdAt:'2026-02-09', updatedAt:'2026-02-16',
})

export function computeStats(ev) {
  if (!ev) return [{value:'-',label:'Incidents',color:'#888'},{value:'-',label:'No-Access',color:'#888'},{value:'-',label:'IDPs',color:'#888'},{value:'-',label:'Health',color:'#888'}]
  const inc=ev.incidents||[], ad=ev.accessDenied||[]
  const disp=inc.find(i=>i.tp==='displacement'), hlth=inc.find(i=>i.tp==='health')
  return [
    {value:String(inc.length),label:'Incidents',color:'#C73E1D'},
    {value:String(ad.length),label:'No-Access',color:'#9B2915'},
    {value:disp?'280K+':'0',label:'IDPs',color:'#D4820C'},
    {value:hlth?'479':'0',label:'Health',color:'#8B6914'},
  ]
}

export function buildSystemPrompt(ev) {
  if (!ev) return 'You are a Humanitarian Aid Corridor Planning AI. Respond in English.'
  const inc=(ev.incidents||[]).map(i=>`${i.ti} (${i.dt})`).join(', ')
  const ad=(ev.accessDenied||[]).map(z=>z.n).join(', ')
  const nb=(ev.notebook||[]).slice(-5).map(n=>n.text).join(' | ')
  return `You are a Humanitarian Aid Corridor Planning AI for "${ev.name}". Be concise.\nBRIEF: ${ev.brief}\nINCIDENTS: ${inc||'None'}\nACCESS DENIED: ${ad||'None'}\nNOTEBOOK (recent): ${nb||'None'}\nSEVERITY: ${ev.severity}`
}

export function renderEventToMap(Lf, event) {
  const g={corridor:Lf.layerGroup(),risks:Lf.layerGroup(),access:Lf.layerGroup(),incidents:Lf.layerGroup(),bases:Lf.layerGroup()}
  if (event.corridor?.length) {
    const cc=event.corridor.map(p=>[p.a,p.o])
    Lf.polyline(cc,{color:'#8B4513',weight:3,opacity:0.7,dashArray:'10 6'}).addTo(g.corridor)
    Lf.polyline(cc,{color:'#8B4513',weight:12,opacity:0.08}).addTo(g.corridor)
    event.corridor.forEach(p=>{
      const c=p.t==='city'?'#3D2B1F':p.t==='base'?'#2E86AB':'#8B7355', r=p.t==='city'?7:p.t==='base'?6:4
      Lf.circleMarker([p.a,p.o],{radius:r,fillColor:c,color:'#FFF',weight:2,fillOpacity:0.9}).bindPopup(`<h3>${p.n}</h3><p>${p.d}</p>`).addTo(g.corridor)
    })
  }
  ;(event.riskZones||[]).forEach(r=>{const sv=SEVERITY[r.s]||SEVERITY.medium;Lf.circle([r.a,r.o],{radius:r.r,fillColor:sv.color,color:sv.color,weight:1.5,fillOpacity:0.08,dashArray:'6 4'}).bindPopup(`<h3>${r.n}</h3><span class='sv' style='background:${sv.bg};color:${sv.color}'>${r.s.toUpperCase()}</span><p>${r.d}</p>`).addTo(g.risks)})
  ;(event.accessDenied||[]).forEach(z=>{Lf.circle([z.a,z.o],{radius:z.r,fillColor:'#C73E1D',color:'#C73E1D',weight:2,fillOpacity:0.1,dashArray:'8 4'}).addTo(g.access);Lf.marker([z.a,z.o],{icon:Lf.divIcon({className:'dl',html:`🚫 ${z.n}<br><span style='font-size:0.8em;opacity:0.7'>NO ACCESS</span>`,iconSize:[130,35]})}).addTo(g.access)})
  ;(event.incidents||[]).forEach(i=>{const sv=SEVERITY[i.s]||SEVERITY.medium,ic=ICON_MAP[i.tp]||'⚠️';Lf.circleMarker([i.a,i.o],{radius:i.s==='critical'?10:8,fillColor:sv.color,color:'#FFF',weight:2,fillOpacity:0.85}).bindPopup(`<h3>${ic} ${i.ti}</h3><span class='sv' style='background:${sv.bg};color:${sv.color}'>${i.s.toUpperCase()}</span> <span class='mt'>${i.dt}</span><p>${i.d}</p><p class='mt'>⚔️ ${i.ac} &nbsp; 🏥 ${i.og}</p>`).addTo(g.incidents);if(i.s==='critical')Lf.circleMarker([i.a,i.o],{radius:18,fillColor:sv.color,color:sv.color,weight:1,fillOpacity:0.12}).addTo(g.incidents)})
  ;(event.bases||[]).forEach(b=>{Lf.marker([b.a,b.o],{icon:Lf.divIcon({className:'dl',html:`<span style='color:#2E86AB;font-size:16px'>🏕️</span>`,iconSize:[20,20]})}).bindPopup(`<h3>🏕️ ${b.n}</h3><p><b>Status:</b> ${b.st}</p><p><b>Capacity:</b> ${b.c}</p>`).addTo(g.bases)})
  return g
}
