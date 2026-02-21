export const ICON_MAP={bombardment:"💥",looting:"🔥","access-denial":"🚫","control-change":"⚑",health:"🦠",displacement:"👥",flood:"🌊",earthquake:"📐"}
export const SEVERITY={critical:{color:"#C73E1D",bg:"#C73E1D22"},high:{color:"#D4820C",bg:"#D4820C1A"},medium:{color:"#A69220",bg:"#A692201A"},low:{color:"#3B7A57",bg:"#3B7A571A"}}
export const BASE_LAYERS=[{id:"osm",name:"OpenStreetMap"},{id:"hot",name:"HOT Humanitarian"},{id:"esri",name:"ESRI Satellite"},{id:"topo",name:"OpenTopoMap"}]
export const INC_TYPES=['bombardment','looting','access-denial','control-change','health','displacement','flood','earthquake']
export const SEV_LEVELS=['critical','high','medium','low']
export const EVENT_TYPES=[{id:'corridor',name:'Corridor',icon:'🛤️'},{id:'crisis',name:'Crisis',icon:'🚨'},{id:'displacement',name:'Displacement',icon:'👥'},{id:'health',name:'Health Emergency',icon:'🏥'},{id:'natural',name:'Natural Disaster',icon:'🌊'},{id:'custom',name:'Custom',icon:'📌'}]
export const COPERNICUS_INSTANCE="2ac66286-c514-43e6-9f14-a15dc697315a"

export function createEvent(ov={}){return{id:'evt_'+Date.now(),name:'New Event',type:'corridor',status:'active',severity:'medium',briefs:[],brief:'',region:{center:[9.5,30.5],zoom:6,bounds:[[4.5,26],[16,34]]},corridor:[],riskZones:[],incidents:[],accessDenied:[],bases:[],drawings:[],notebook:[],createdAt:new Date().toISOString().slice(0,10),updatedAt:new Date().toISOString().slice(0,10),...ov}}

export const SUDAN_EVENT=createEvent({id:'evt_sudan_ss',name:'Sudan → South Sudan Corridor',type:'corridor',status:'active',severity:'critical',briefs:[{id:'b1',text:'Khartoum to Juba corridor (1,850km). Jonglei: 280K+ displaced, 3 counties access-denied, cholera in Duk County.',ts:'2026-02-09T10:00:00Z',archived:false},{id:'b2',text:'SSPDF declared control of Lankien. New commissioner appointed. UN/MSF advocating for humanitarian flights. Cholera response ongoing by MSF France.',ts:'2026-02-12T08:00:00Z',archived:false}],brief:'Khartoum to Juba corridor (1,850km). Jonglei: 280K+ displaced, 3 counties access-denied, cholera in Duk County.',region:{center:[9.5,30.5],zoom:6,bounds:[[4.5,26],[16,34]]},corridor:[{n:"Khartoum",a:15.5,o:32.5,t:"city",d:"Origin — Coordination HQ"},{n:"El-Obeid",a:13.18,o:30.22,t:"wp",d:"Logistics transfer"},{n:"Kadugli",a:11.0,o:29.7,t:"wp",d:"South Kordofan"},{n:"Abyei",a:9.6,o:28.4,t:"rz",d:"Disputed territory"},{n:"Aweil",a:8.77,o:27.39,t:"wp",d:"N. Bahr el Ghazal"},{n:"Wau",a:7.7,o:28.0,t:"base",d:"Forward base"},{n:"Rumbek",a:6.8,o:29.7,t:"wp",d:"Lakes — Flood risk"},{n:"Bor",a:6.2,o:31.56,t:"wp",d:"Nile crossing"},{n:"Juba",a:4.85,o:31.58,t:"city",d:"Destination"}],riskZones:[{n:"South Kordofan",a:11.5,o:29.5,r:80000,s:"high",d:"Active conflict"},{n:"Abyei Disputed",a:9.6,o:28.8,r:70000,s:"critical",d:"Sovereignty dispute"},{n:"Sudd Flood",a:7.0,o:30.0,r:100000,s:"medium",d:"Jun–Oct impassable"},{n:"Jonglei Conflict",a:8.0,o:31.5,r:120000,s:"critical",d:"280K+ displaced"}],incidents:[{id:"i1",dt:"2026-02-03",a:8.28,o:31.60,tp:"bombardment",s:"critical",ti:"Lankien Hospital Airstrike",d:"OCA hospital warehouse damaged by aerial bombardment.",ac:"SSPDF",og:"MSF Holland"},{id:"i2",dt:"2026-02-03",a:8.45,o:31.75,tp:"looting",s:"high",ti:"Pieri PHCC Looted",d:"OCA Pieri PHCC looted by armed men.",ac:"Unknown",og:"MSF Holland"},{id:"i3",dt:"2026-02-04",a:8.60,o:32.20,tp:"looting",s:"high",ti:"Walgak Office Burned",d:"Save the Children office burned.",ac:"Unknown",og:"Save the Children"},{id:"i4",dt:"2026-01-26",a:8.0,o:31.5,tp:"access-denial",s:"critical",ti:"Evacuation Order",d:"Nyirol/Uror/Akobo 48h forced evacuation.",ac:"SSPDF",og:"Multiple"},{id:"i5",dt:"2026-02-08",a:8.28,o:31.60,tp:"control-change",s:"high",ti:"Lankien Control to SSPDF",d:"SSPDF declared control of Lankien town.",ac:"SSPDF",og:"UN/MSF"},{id:"i6",dt:"2026-01-01",a:7.7,o:31.3,tp:"health",s:"high",ti:"Cholera — Duk County",d:"~479 cholera cases, response by MSF France.",ac:"N/A",og:"MSF France"},{id:"i7",dt:"2025-12-15",a:8.3,o:31.8,tp:"displacement",s:"critical",ti:"280K+ Displaced",d:"Over 280,000 displaced across Jonglei.",ac:"SSPDF/SPLA-iO",og:"IOM/UNHCR"}],accessDenied:[{n:"Nyirol County",a:8.5,o:31.6,r:45000},{n:"Uror County",a:8.1,o:32.0,r:50000},{n:"Akobo County",a:7.8,o:33.0,r:55000}],bases:[{n:"Khartoum HQ",a:15.5,o:32.5,st:"Active",c:"Full ops"},{n:"Wau Forward",a:7.7,o:28.0,st:"Setup",c:"60%"},{n:"Juba Dist.",a:4.85,o:31.58,st:"Planning",c:"Distribution"}],notebook:[{id:'n1',author:'System',type:'update',text:'Event created from Jonglei briefing. See @i1 Lankien Hospital Airstrike.',ts:'2026-02-09T10:00:00Z'}],createdAt:'2026-02-09',updatedAt:'2026-02-16'})

export function computeStats(ev){if(!ev)return[];const inc=ev.incidents||[],ad=ev.accessDenied||[];const disp=inc.find(i=>i.tp==='displacement'),hlth=inc.find(i=>i.tp==='health');return[{value:String(inc.length),label:'Incidents',color:'#C73E1D'},{value:String(ad.length),label:'No-Access',color:'#9B2915'},{value:disp?'280K+':'0',label:'IDPs',color:'#D4820C'},{value:hlth?'479':'0',label:'Health',color:'#8B6914'}]}
export function computeTypeCounts(ev){const c={};(ev?.incidents||[]).forEach(i=>{c[i.tp]=(c[i.tp]||0)+1});return c}
export function buildSystemPrompt(ev){if(!ev)return'You are a Humanitarian Corridor AI.';const inc=(ev.incidents||[]).map(i=>`${i.ti}(${i.dt},${i.s})`).join(', ');const briefs=(ev.briefs||[]).filter(b=>!b.archived).map(b=>b.text).join(' | ');return`You are a Humanitarian Corridor AI for "${ev.name}". Be concise, operational.\nBRIEFS: ${briefs||ev.brief||'None'}\nINCIDENTS: ${inc||'None'}\nACCESS DENIED: ${(ev.accessDenied||[]).map(z=>z.n).join(', ')||'None'}\nSEVERITY: ${ev.severity}\nProvide geographic coordinates when relevant. Format locations as [lat, lon].`}
export const BRIEF_ANALYSIS_PROMPT=`Analyze this humanitarian brief. Extract ALL incidents with geographic coordinates. Return ONLY valid JSON array. Each item: {"ti":"title","d":"description","a":lat_number,"o":lng_number,"s":"critical|high|medium|low","tp":"bombardment|looting|access-denial|control-change|health|displacement|flood|earthquake","dt":"YYYY-MM-DD","ac":"actor","og":"organization"}. MUST have numeric a and o fields. Estimate coordinates from place names if not explicit. Brief:`

export function renderEventToMap(Lf,ev,anim=true,onViewDetail){
  const g={corridor:Lf.layerGroup(),risks:Lf.layerGroup(),access:Lf.layerGroup(),incidents:Lf.layerGroup(),bases:Lf.layerGroup(),drawings:Lf.layerGroup()}
  const vdBtn=(type,id)=>onViewDetail?`<br><button onclick="window.__cpViewDetail('${type}','${id}')" style="margin-top:6px;padding:4px 12px;border-radius:5px;border:1px solid #C9A84C;background:transparent;color:#C9A84C;cursor:pointer;font-family:inherit;font-size:11px;font-weight:600;width:100%">View Details →</button>`:''
  if(ev.corridor?.length){
    const cc=ev.corridor.map(p=>[p.a,p.o]);
    const ln=Lf.polyline(cc,{color:'#8B4513',weight:3,opacity:.7,dashArray:ev.severity==='critical'?'12 6':'14 8'});
    if(anim)ln.on('add',()=>{const e=ln.getElement();if(e)e.classList.add(ev.severity==='critical'?'anim-dash-fast':'anim-dash')});
    ln.addTo(g.corridor);Lf.polyline(cc,{color:'#8B4513',weight:12,opacity:.08}).addTo(g.corridor);
    ev.corridor.forEach((p,pi)=>{const c=p.t==='city'?'#3D2B1F':p.t==='base'?'#2E86AB':'#8B7355',r=p.t==='city'?8:p.t==='base'?7:5;
    Lf.circleMarker([p.a,p.o],{radius:r,fillColor:c,color:'#FFF',weight:2,fillOpacity:.9}).bindPopup(`<b>${p.n}</b><br><span style="color:#8B7355">${p.d}</span>${vdBtn('waypoint','wp_'+pi)}`).addTo(g.corridor)})
  }
  ;(ev.riskZones||[]).forEach((r,ri)=>{const sv=SEVERITY[r.s]||SEVERITY.medium;Lf.circle([r.a,r.o],{radius:r.r,fillColor:sv.color,color:sv.color,weight:1.5,fillOpacity:.08,dashArray:'6 4'}).bindPopup(`<b>${r.n}</b> <span style="color:${sv.color};font-weight:700">${r.s.toUpperCase()}</span><br>${r.d}${vdBtn('risk','rz_'+ri)}`).addTo(g.risks)})
  ;(ev.accessDenied||[]).forEach(z=>{Lf.circle([z.a,z.o],{radius:z.r,fillColor:'#C73E1D',color:'#C73E1D',weight:2,fillOpacity:.1,dashArray:'8 4'}).addTo(g.access);Lf.marker([z.a,z.o],{icon:Lf.divIcon({className:'dl',html:`🚫 ${z.n}`,iconSize:[120,25]})}).addTo(g.access)})
  ;(ev.incidents||[]).forEach((i,idx)=>{const sv=SEVERITY[i.s]||SEVERITY.medium,ic=ICON_MAP[i.tp]||'⚠️';
    const baseR={critical:14,high:10,medium:8,low:6}[i.s]||8;
    const cm=Lf.circleMarker([i.a,i.o],{radius:baseR,fillColor:sv.color,color:'#FFF',weight:2.5,fillOpacity:.9}).bindPopup(`<b>${ic} ${i.ti}</b><br><span style="color:${sv.color};font-weight:700">${i.s.toUpperCase()}</span> · ${i.dt}<br>${i.d}<br><small>⚔️ ${i.ac} · 🏥 ${i.og}</small>${vdBtn('incident',i.id)}`);
    if(anim&&(i.s==='critical'||i.s==='high'))cm.on('add',()=>{const e=cm.getElement();if(e)e.classList.add('anim-pulse')});
    cm.addTo(g.incidents);
    const glowR={critical:40000,high:25000,medium:15000,low:8000}[i.s]||15000;
    Lf.circle([i.a,i.o],{radius:glowR,fillColor:sv.color,color:sv.color,weight:1,fillOpacity:.07,dashArray:'4 3'}).addTo(g.incidents)})
  // Dashed lines between nearby/related incidents (same region, <200km apart)
  const incs=ev.incidents||[];
  for(let a=0;a<incs.length;a++){for(let b=a+1;b<incs.length;b++){
    const d=Math.sqrt(Math.pow(incs[a].a-incs[b].a,2)+Math.pow(incs[a].o-incs[b].o,2));
    if(d<2.5){// ~250km rough threshold
      const maxSev=['critical','high','medium','low'].indexOf(incs[a].s)<=['critical','high','medium','low'].indexOf(incs[b].s)?incs[a].s:incs[b].s;
      const col=(SEVERITY[maxSev]||SEVERITY.medium).color;
      Lf.polyline([[incs[a].a,incs[a].o],[incs[b].a,incs[b].o]],{color:col,weight:1.5,opacity:.35,dashArray:'6 4'}).addTo(g.incidents)
    }
  }}
  ;(ev.bases||[]).forEach((b,bi)=>{Lf.marker([b.a,b.o],{icon:Lf.divIcon({className:'dl',html:`<span style='color:#2E86AB;font-size:16px'>🏕️</span>`,iconSize:[20,20]})}).bindPopup(`<b>🏕️ ${b.n}</b><br>${b.st} · ${b.c||''}${vdBtn('base','ba_'+bi)}`).addTo(g.bases)})
  ;(ev.drawings||[]).forEach(d=>{if(d.type==='circle')Lf.circle([d.a,d.o],{radius:d.r||50000,fillColor:d.color||'#C73E1D',color:d.color||'#C73E1D',weight:2,fillOpacity:.12,dashArray:'8 4'}).bindPopup(`<b>${d.label||'Zone'}</b>`).addTo(g.drawings)})
  return g
}
export function eventToGeoJSON(ev){const f=[];(ev.incidents||[]).forEach(i=>f.push({type:'Feature',geometry:{type:'Point',coordinates:[i.o,i.a]},properties:{name:i.ti,severity:i.s,type:i.tp,date:i.dt,description:i.d,actor:i.ac,org:i.og}}));(ev.corridor||[]).forEach(p=>f.push({type:'Feature',geometry:{type:'Point',coordinates:[p.o,p.a]},properties:{name:p.n,type:'waypoint'}}));if(ev.corridor?.length>1)f.push({type:'Feature',geometry:{type:'LineString',coordinates:ev.corridor.map(p=>[p.o,p.a])},properties:{name:ev.name+' Corridor',type:'corridor'}});return{type:'FeatureCollection',properties:{event:ev.name,exported:new Date().toISOString()},features:f}}
export function eventToCSV(ev){const r=[['Type','Name','Lat','Lon','Severity','Date','Description','Actor','Org']];(ev.incidents||[]).forEach(i=>r.push(['Incident',`"${i.ti}"`,i.a,i.o,i.s,i.dt,`"${(i.d||'').replace(/"/g,'""')}"`,i.ac,i.og]));(ev.corridor||[]).forEach(p=>r.push(['Waypoint',p.n,p.a,p.o,'','',`"${p.d||''}"`,'-','-']));return r.map(x=>x.join(',')).join('\n')}
export function eventToReport(ev){const l=[];l.push(`# ${ev.name}\n**${ev.severity?.toUpperCase()}** | ${ev.status} | Updated: ${ev.updatedAt}\n`);l.push(`## Brief\n${ev.brief||'N/A'}\n`);if((ev.briefs||[]).length){l.push('## Briefs Timeline');ev.briefs.forEach(b=>l.push(`- [${new Date(b.ts).toLocaleDateString()}] ${b.text}${b.archived?' *(archived)*':''}`));l.push('')}if((ev.incidents||[]).length){l.push(`## Incidents (${ev.incidents.length})`);ev.incidents.forEach(i=>l.push(`- **${i.ti}** (${i.dt}) — ${i.s.toUpperCase()} — ${i.d}`));l.push('')}if((ev.notebook||[]).length){l.push('## Field Notes');ev.notebook.forEach(n=>l.push(`- [${n.author}] ${n.text}`));l.push('')}l.push(`---\n*Corridor Planner v3 — ${new Date().toISOString().slice(0,10)}*`);return l.join('\n')}
export function encodeShare(ev,pw=''){const p={n:ev.name,s:ev.severity,st:ev.status,b:ev.brief,tp:ev.type,bs:(ev.briefs||[]).filter(x=>!x.archived).map(x=>({t:x.text,d:x.ts})),r:ev.region,c:ev.corridor,rz:ev.riskZones,i:(ev.incidents||[]).map(x=>({id:x.id,dt:x.dt,a:x.a,o:x.o,tp:x.tp,s:x.s,ti:x.ti,d:x.d,ac:x.ac,og:x.og})),ad:ev.accessDenied,ba:ev.bases,dr:ev.drawings||[],nb:(ev.notebook||[]).slice(-10).map(x=>({a:x.author,t:x.text})),pw};return btoa(unescape(encodeURIComponent(JSON.stringify(p))))}
export function decodeShare(enc){try{const p=JSON.parse(decodeURIComponent(escape(atob(enc))));return{event:createEvent({id:'sh_'+Date.now(),name:p.n||'Shared',type:p.tp||'corridor',severity:p.s||'medium',status:p.st||'shared',brief:p.b||'',briefs:(p.bs||[]).map((x,i)=>({id:'sb_'+i,text:x.t,ts:x.d,archived:false})),region:p.r||{center:[9.5,30.5],zoom:6,bounds:[[4.5,26],[16,34]]},corridor:p.c||[],riskZones:p.rz||[],incidents:(p.i||[]).map(x=>({...x})),accessDenied:p.ad||[],bases:p.ba||[],drawings:p.dr||[],notebook:(p.nb||[]).map((x,i)=>({id:'sn_'+i,author:x.a||'Shared',type:'note',text:x.t,ts:new Date().toISOString()}))}),pw:p.pw||''}}catch(e){console.error('Share decode error:',e);return null}}
export function buildOverpassQuery(type,bounds){const[s,w,n,e]=[bounds.getSouth(),bounds.getWest(),bounds.getNorth(),bounds.getEast()];const bb=`${s},${w},${n},${e}`;return{hospitals:`[out:json][timeout:25];(node["amenity"="hospital"](${bb});way["amenity"="hospital"](${bb});node["amenity"="clinic"](${bb}););out center body 100;`,water:`[out:json][timeout:25];(node["amenity"="drinking_water"](${bb});node["man_made"="water_well"](${bb});node["natural"="spring"](${bb});node["man_made"="water_tower"](${bb}););out body 100;`,roads:`[out:json][timeout:25];way["highway"~"trunk|primary|secondary"](${bb});out geom 200;`}[type]||''}

// Local geocoding fallback dictionary (offline/rate-limit safety net)
const GEO_DICT={khartoum:[15.5,32.5],juba:[4.85,31.58],lankien:[8.28,31.60],pieri:[8.45,31.75],walgak:[8.60,32.20],bor:[6.2,31.56],malakal:[9.53,31.66],bentiu:[9.23,29.78],wau:[7.7,28.0],aweil:[8.77,27.39],rumbek:[6.8,29.7],kadugli:[11.0,29.7],abyei:[9.6,28.4],"el-obeid":[13.18,30.22],"el obeid":[13.18,30.22],nyirol:[8.5,31.6],uror:[8.1,32.0],akobo:[7.8,33.0],duk:[7.7,31.3],jonglei:[8.0,31.5],renk:[11.75,32.78],kodok:[9.68,32.12],fashoda:[9.88,32.05],torit:[4.41,32.58],yambio:[4.57,28.39],maridi:[4.92,29.48],nasir:[8.6,33.07],pochalla:[7.4,33.9],kapoeta:[4.77,33.59],nimule:[3.6,32.05],leer:[8.3,30.15],fangak:[8.9,31.65],sobat:[9.0,32.7],melut:[10.45,32.2],nasser:[8.6,33.07],mogadishu:[2.05,45.32],addis:[9.02,38.75],nairobi:[1.29,36.82],kampala:[0.35,32.58],asmara:[15.34,38.94],ndjamena:[12.13,15.05],cairo:[30.04,31.24],darfur:[13.5,25.0],"south kordofan":[11.5,29.5],kassala:[15.45,36.4],gedaref:[14.03,35.39],"port sudan":[19.62,37.22],atbara:[17.7,33.97],dongola:[19.17,30.48],"wad madani":[14.4,33.53],sennar:[13.55,33.62],"blue nile":[11.5,34.5],"white nile":[13.0,32.5],gezira:[14.5,33.5]}
const INC_KW={bombardment:['airstrike','bomb','shell','attack','aerial','strike','mortar'],looting:['loot','burn','ransack','pillage','rob','steal','arson'],'access-denial':['evacuat','denied','block','restrict','ban','access denied','force out'],'control-change':['control','capture','seize','took over','declared','occupy'],health:['cholera','disease','outbreak','epidemic','malaria','measles','polio','health'],displacement:['displac','fled','refugee','idp','migrat','flee','camp'],flood:['flood','rain','inundat','water level','overflow'],earthquake:['earthquake','quake','seismic','tremor']}
const SEV_KW={critical:['critical','mass','large-scale','catastroph','extreme','devastating','massacre'],high:['high','significant','serious','major','severe'],medium:['moderate','ongoing','reported'],low:['minor','small','limited','isolated']}

// Nominatim geocoding cache (persists during session)
const _geoCache={}
async function geocode(placeName){
  const key=placeName.toLowerCase().trim()
  if(_geoCache[key])return _geoCache[key]
  // Check local dict first
  if(GEO_DICT[key]){_geoCache[key]=GEO_DICT[key];return GEO_DICT[key]}
  // Try Nominatim (OSM free geocoding — whole world, village-level)
  try{
    const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1`,{headers:{'User-Agent':'CorridorPlanner/3.0'}})
    const d=await r.json()
    if(d&&d[0]){const coords=[+d[0].lat,+d[0].lon];_geoCache[key]=coords;return coords}
  }catch(e){console.warn('Nominatim error:',e)}
  return null
}

// Extract place name candidates from text using NLP-light heuristics
function extractPlaces(text){
  const places=new Set()
  // Capitalized words (2+ chars) not at sentence start — likely proper nouns
  const caps=text.match(/(?<=[.!?\n]\s*\w+\s+|,\s*|;\s*|in\s+|at\s+|near\s+|from\s+|to\s+|of\s+|around\s+)([A-Z][a-zA-Z\u00C0-\u024F'-]{2,}(?:\s+[A-Z][a-zA-Z\u00C0-\u024F'-]{2,}){0,3})/g)||[]
  caps.forEach(c=>places.add(c))
  // Also try known patterns: "in/at/near PLACE", "PLACE county/province/city/region/district"
  const patterns=text.match(/(?:in|at|near|from|around|outside)\s+([A-Z][a-zA-Z\u00C0-\u024F' -]{2,30})/g)||[]
  patterns.forEach(p=>places.add(p.replace(/^(?:in|at|near|from|around|outside)\s+/i,'')))
  // Check GEO_DICT keys case-insensitively
  const lw=text.toLowerCase()
  for(const name of Object.keys(GEO_DICT)){if(lw.includes(name))places.add(name)}
  return[...places].filter(p=>p.length>2&&!['The','This','That','They','Their','These','There','After','Before','During','While','Where','Which','About','Other','Under','Above','Between','Within','Through','Against','Across','Behind','Beyond','Since','Until','From','Into','With','Have','Been','Were','Could','Would','Should','Must','More','Most','Some','Many','Such','Each','Every','Also','Still','Only','Just','Very','Even','Much','Well'].includes(p))
}

export async function localParseBrief(text,onProgress){
  const sentences=text.split(/[.;!\n]+/).filter(s=>s.trim().length>10)
  const results=[]
  const allPlaces=extractPlaces(text)
  // Geocode all unique places (with 200ms delay between Nominatim calls for rate limit)
  const resolved={}
  let i=0
  for(const place of allPlaces){
    const coords=await geocode(place)
    if(coords)resolved[place.toLowerCase()]=coords
    i++
    if(onProgress)onProgress(Math.round(i/allPlaces.length*100))
    // Nominatim rate limit: 1 req/sec — only delay if we actually hit the API
    if(!GEO_DICT[place.toLowerCase()]&&!_geoCache[place.toLowerCase()])await new Promise(r=>setTimeout(r,250))
  }
  sentences.forEach(sent=>{
    const sl=sent.toLowerCase().trim()
    let loc=null,locName=''
    // Match against resolved places
    for(const[name,coords]of Object.entries(resolved)){if(sl.includes(name)){loc=coords;locName=name;break}}
    if(!loc)return
    let tp='displacement'
    for(const[type,kws]of Object.entries(INC_KW)){if(kws.some(k=>sl.includes(k))){tp=type;break}}
    let sv='medium'
    for(const[level,kws]of Object.entries(SEV_KW)){if(kws.some(k=>sl.includes(k))){sv=level;break}}
    const dateM=sl.match(/\d{4}-\d{2}-\d{2}/)
    const title=locName.charAt(0).toUpperCase()+locName.slice(1)+' — '+(ICON_MAP[tp]||'')+(tp.charAt(0).toUpperCase()+tp.slice(1))
    if(!results.find(r=>Math.abs(r.a-loc[0])<0.01&&Math.abs(r.o-loc[1])<0.01&&r.tp===tp))
      results.push({id:'lp_'+Date.now()+'_'+results.length,dt:dateM?dateM[0]:new Date().toISOString().slice(0,10),a:loc[0],o:loc[1],tp,s:sv,ti:title,d:sent.trim().slice(0,150),ac:'Unknown',og:'Parsed ('+allPlaces.length+' locations)'})
  })
  return results
}
