import { getStatusInfo } from '../utils/helpers'

const BG = ['#1a1e2a','#1e1a2a','#1a2a1e','#2a1a1a','#1e2028','#201a24']

// Route all .gov.ng images through wsrv.nl to bypass hotlink blocking
function proxyImg(url) {
  if (!url) return null
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=320&h=380&fit=cover&we&output=jpg`
}

export default function WantedCard({ person, onClick }) {
  const status = getStatusInfo(person.status)
  const isActive      = person.status === 'Wanted' || person.status === 'Critical'
  const isApprehended = person.status === 'Apprehended' || person.status === 'Convicted'
  const initials = person.name.split(' ').filter(w=>w.length>1).map(w=>w[0]).slice(0,2).join('').toUpperCase() || '?'
  const bg = BG[Math.abs((person.name.charCodeAt(0)||0)+(person.name.charCodeAt(2)||0))%BG.length]

  return (
    <div onClick={()=>onClick(person)}
      style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden', cursor:'pointer', opacity:isApprehended?0.72:1, transition:'all 0.22s' }}
      onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.borderColor=isActive&&!isApprehended?'var(--accent)':'var(--border2)'; e.currentTarget.style.boxShadow=isActive&&!isApprehended?'0 8px 32px rgba(232,52,10,0.18)':'0 8px 24px rgba(0,0,0,0.4)' }}
      onMouseLeave={e=>{ e.currentTarget.style.transform=''; e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.boxShadow='' }}
    >
      {/* IMAGE */}
      <div style={{ position:'relative', height:200, background:bg, overflow:'hidden' }}>
        {person.imageUrl
          ? <img src={proxyImg(person.imageUrl)} alt={person.name} loading="lazy"
              style={{ width:'100%', height:'100%', objectFit:'cover', filter:'grayscale(8%)' }}
              onError={e=>{ if(!e.target.dataset.fallback){ e.target.dataset.fallback='1'; e.target.src=person.imageUrl } else { e.target.style.display='none' } }}
            />
          : <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6 }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--display)', fontSize:24, color:'rgba(255,255,255,0.22)' }}>{initials}</div>
              <div style={{ fontFamily:'var(--mono)', fontSize:8, color:'rgba(255,255,255,0.16)', letterSpacing:'0.15em' }}>NO PHOTO</div>
            </div>
        }
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(10,12,16,0.92) 0%,transparent 52%)' }}/>
        <div style={{ position:'absolute', top:9, left:10, width:8, height:8, borderRadius:'50%', background:person.agencyColor||'#888', boxShadow:`0 0 6px ${person.agencyColor||'transparent'}` }}/>
        <span className={`badge ${status.cls}`} style={{ position:'absolute', top:9, right:9 }}>{status.label}</span>
        {person.reward && (
          <div style={{ position:'absolute', bottom:9, left:11 }}>
            <div style={{ fontFamily:'var(--mono)', fontSize:7, color:'rgba(212,160,23,0.75)', letterSpacing:'0.15em' }}>REWARD</div>
            <div style={{ fontFamily:'var(--display)', fontSize:18, color:'var(--gold)', letterSpacing:'0.04em', lineHeight:1 }}>{person.reward}</div>
          </div>
        )}
      </div>
      {/* BODY */}
      <div style={{ padding:'12px 13px 8px' }}>
        <div style={{ fontFamily:'var(--display)', fontSize:person.name.length>24?15:19, letterSpacing:'0.04em', lineHeight:1.1, marginBottom:2 }}>
          {person.name.length>30 ? person.name.slice(0,28)+'…' : person.name.toUpperCase()}
        </div>
        {person.alias && <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text3)', marginBottom:8 }}>AKA "{person.alias}"</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:3, marginTop:8 }}>
          {person.refId  && <Row k="REF"   v={person.refId}/>}
          {person.state  && <Row k="STATE" v={person.state}/>}
        </div>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:9 }}>
          <span style={{ fontFamily:'var(--mono)', fontSize:8, padding:'2px 6px', borderRadius:1, background:'rgba(232,52,10,0.1)', color:'var(--accent)', border:'1px solid rgba(232,52,10,0.22)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
            {(person.crime||'Unknown').split('/')[0].trim().slice(0,24)}
          </span>
          <span style={{ fontFamily:'var(--mono)', fontSize:8, padding:'2px 6px', borderRadius:1, background:`${person.agencyColor||'#888'}1a`, color:person.agencyColor||'var(--text2)', border:`1px solid ${person.agencyColor||'#888'}35`, letterSpacing:'0.06em' }}>
            {person.agencyLabel}
          </span>
        </div>
      </div>
      {/* FOOTER */}
      <div style={{ padding:'8px 13px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--text3)' }}>{person.state||person.agencyLabel}</span>
        <span style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--accent)', letterSpacing:'0.06em' }}>VIEW →</span>
      </div>
    </div>
  )
}
function Row({k,v}){ return <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--text3)'}}>{k}</span><span style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--text2)'}}>{v}</span></div> }
