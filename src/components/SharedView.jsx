import{useState,useRef,useEffect}from'react'
import{ICON_MAP,SEVERITY,computeStats,renderEventToMap}from'../data/events.js'

export default function SharedView({data}){
  const[pw,setPw]=useState('')
  const[unlocked,setUnlocked]=useState(!data.pw)
  const[err,setErr]=useState(false)
  const[loading,setLoading]=useState(false)
  const mR=useRef(null),cR=useRef(null)
  const ev=data.event,stats=computeStats(ev)
  const sI=[...(ev.incidents||[])].sort((a,b)=>a.dt.localeCompare(b.dt))

  useEffect(()=>{document.documentElement.setAttribute('data-theme','dark')},[])

  useEffect(()=>{
    if(!unlocked||mR.current)return
    setTimeout(()=>{
      import('leaflet').then(mod=>{
        const L=mod.default||mod
        delete L.Icon.Default.prototype._getIconUrl
        L.Icon.Default.mergeOptions({iconRetinaUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'})
        const m=L.map(cR.current,{zoomControl:true}).setView(ev.region?.center||[9.5,30.5],ev.region?.zoom||6)
        mR.current=m
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{maxZoom:20}).addTo(m)
        const layers=renderEventToMap(L,ev,true)
        Object.values(layers).forEach(l=>l.addTo(m))
        if(ev.region?.bounds)m.fitBounds(ev.region.bounds,{padding:[30,30]})
      })
    },100)
  },[unlocked])

  const tryPw=()=>{
    setLoading(true)
    setTimeout(()=>{
      if(pw===data.pw){setUnlocked(true);setErr(false)}
      else setErr(true)
      setLoading(false)
    },800)
  }

  // Password gate
  if(!unlocked)return(
    <div style={{width:'100vw',height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0F0F0F',flexDirection:'column',gap:24}}>
      <div style={{fontSize:28,fontWeight:700,color:'#E8E0D4',fontFamily:"'Source Serif 4',serif",letterSpacing:'.03em'}}>🔒 CORRIDOR PLANNER</div>
      <div style={{fontSize:14,color:'#8B7355'}}>This shared event is password protected</div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <input type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&tryPw()} placeholder="Enter password" style={{padding:'12px 16px',borderRadius:10,border:'1px solid #3A332A',background:'#1E1E1E',color:'#E8E0D4',fontSize:15,fontFamily:'inherit',outline:'none',width:240}}/>
        <button onClick={tryPw} disabled={loading} style={{width:48,height:48,borderRadius:10,border:'none',background:'#C9A84C',color:'#0F0F0F',cursor:'pointer',fontWeight:700,fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>
          {loading?<span style={{width:20,height:20,border:'2px solid #0F0F0F',borderTopColor:'transparent',borderRadius:'50%',animation:'spin .8s linear infinite',display:'inline-block'}}/>:'→'}
        </button>
      </div>
      {err&&<div style={{color:'#E8553A',fontSize:13}}>Wrong password. Try again.</div>}
    </div>
  )

  // Unlocked shared view
  return(
    <div style={{width:'100vw',height:'100vh',display:'flex',flexDirection:'column',background:'var(--bg-primary)'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderBottom:'1px solid var(--border-primary)',background:'var(--bg-secondary)',flexShrink:0}}>
        <span style={{width:8,height:8,borderRadius:'50%',background:'var(--danger)',boxShadow:'0 0 6px var(--danger-glow)'}}/>
        <b style={{fontSize:'calc(var(--fs)*.82)',letterSpacing:'.04em'}}>CORRIDOR PLANNER</b>
        <span style={{fontSize:'calc(var(--fs)*.5)',padding:'2px 6px',borderRadius:3,background:'var(--accent-bg)',color:'var(--accent)',fontWeight:700}}>SHARED VIEW</span>
        <span style={{marginLeft:'auto',fontSize:'calc(var(--fs)*.55)',padding:'2px 8px',borderRadius:3,background:(SEVERITY[ev.severity]||SEVERITY.medium).bg,color:(SEVERITY[ev.severity]||SEVERITY.medium).color,fontWeight:700}}>{ev.severity?.toUpperCase()}</span>
      </div>
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        {/* Sidebar */}
        <div style={{width:340,minWidth:340,display:'flex',flexDirection:'column',background:'var(--bg-secondary)',borderRight:'1px solid var(--border-primary)',overflowY:'auto'}}>
          <div style={{padding:'14px 16px',borderBottom:'1px solid var(--border-subtle)'}}>
            <div style={{fontSize:'calc(var(--fs)*.92)',fontWeight:700,marginBottom:6}}>{ev.name}</div>
            <div style={{fontSize:'calc(var(--fs)*.72)',color:'var(--text-secondary)',lineHeight:1.7}}>{ev.brief}</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:3,padding:'8px 12px',borderBottom:'1px solid var(--border-subtle)'}}>
            {stats.map(s=><div key={s.label} style={{padding:'5px 2px',borderRadius:4,textAlign:'center',background:'var(--surface-card)'}}>
              <div style={{fontSize:'calc(var(--fs)*1)',fontWeight:700,color:s.color}}>{s.value}</div>
              <div style={{fontSize:'calc(var(--fs)*.45)',color:'var(--text-muted)'}}>{s.label}</div>
            </div>)}
          </div>
          {/* Briefs */}
          {(ev.briefs||[]).length>0&&<div style={{padding:'10px 16px',borderBottom:'1px solid var(--border-subtle)'}}>
            <div style={{fontSize:'calc(var(--fs)*.6)',fontWeight:700,color:'var(--text-muted)',marginBottom:6,textTransform:'uppercase'}}>Briefs ({ev.briefs.length})</div>
            {ev.briefs.map(b=><div key={b.id} style={{padding:'6px 0',borderBottom:'1px solid var(--border-subtle)',fontSize:'calc(var(--fs)*.68)',lineHeight:1.6}}>
              <div style={{fontSize:'calc(var(--fs)*.48)',color:'var(--text-faint)',marginBottom:2}}>{new Date(b.ts).toLocaleDateString()}</div>
              <div style={{color:'var(--text-secondary)'}}>{b.text}</div>
            </div>)}
          </div>}
          {/* Incidents */}
          <div style={{padding:'10px 16px',flex:1}}>
            <div style={{fontSize:'calc(var(--fs)*.6)',fontWeight:700,color:'var(--text-muted)',marginBottom:6,textTransform:'uppercase'}}>Incidents ({sI.length})</div>
            {sI.map(inc=>{const sv=SEVERITY[inc.s]||SEVERITY.medium;return(
              <div key={inc.id} onClick={()=>mR.current?.setView([inc.a,inc.o],9)} style={{padding:'6px 8px',borderRadius:6,marginBottom:3,cursor:'pointer',border:'1px solid var(--border-primary)',background:'var(--surface-card)',fontSize:'calc(var(--fs)*.68)'}}>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <span>{ICON_MAP[inc.tp]||'⚠️'}</span>
                  <b style={{flex:1}}>{inc.ti}</b>
                  <span style={{fontSize:'calc(var(--fs)*.5)',padding:'1px 5px',borderRadius:3,fontWeight:700,background:sv.bg,color:sv.color}}>{inc.s.toUpperCase()}</span>
                </div>
                <div style={{fontSize:'calc(var(--fs)*.55)',color:'var(--text-faint)',marginTop:2}}>{inc.dt} · {inc.d}</div>
              </div>
            )})}
          </div>
          {/* Field Notes */}
          {(ev.notebook||[]).length>0&&<div style={{padding:'10px 16px',borderTop:'1px solid var(--border-subtle)'}}>
            <div style={{fontSize:'calc(var(--fs)*.6)',fontWeight:700,color:'var(--text-muted)',marginBottom:6,textTransform:'uppercase'}}>Field Notes</div>
            {ev.notebook.map(n=><div key={n.id} style={{fontSize:'calc(var(--fs)*.65)',color:'var(--text-secondary)',marginBottom:4}}>
              <span style={{color:'var(--accent)',fontWeight:600}}>{n.author}:</span> {n.text}
            </div>)}
          </div>}
        </div>
        {/* Map */}
        <div style={{flex:1,position:'relative'}}>
          <div ref={cR} style={{width:'100%',height:'100%'}}/>
          {/* Timeline */}
          {sI.length>0&&<div style={{position:'absolute',bottom:16,left:'50%',transform:'translateX(-50%)',zIndex:1000,display:'flex',gap:8,background:'var(--glass-strong)',border:'1px solid var(--border-primary)',borderRadius:12,padding:'10px 18px',alignItems:'center',boxShadow:'var(--shadow-md)'}}>
            <span style={{fontSize:'calc(var(--fs)*.72)',color:'var(--text-muted)',fontWeight:700,marginRight:6}}>TIMELINE</span>
            {sI.map(inc=><div key={inc.id} onClick={()=>mR.current?.setView([inc.a,inc.o],9)} style={{display:'flex',flexDirection:'column',alignItems:'center',cursor:'pointer',padding:'4px 8px',borderRadius:8}} title={inc.ti}>
              <span style={{fontSize:'calc(var(--fs)*1.3)'}}>{ICON_MAP[inc.tp]||'⚠️'}</span>
              <span style={{fontSize:'calc(var(--fs)*.62)',color:(SEVERITY[inc.s]||SEVERITY.medium).color,marginTop:3,fontWeight:700}}>{inc.dt.slice(5)}</span>
            </div>)}
          </div>}
        </div>
      </div>
    </div>
  )
}
