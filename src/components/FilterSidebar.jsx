import { CRIME_CATEGORIES, STATES } from '../utils/helpers'

export default function FilterSidebar({ filters, setFilters, total, onFaceSearch }) {
  const update = (key, val) => setFilters(prev => ({ ...prev, [key]: val }))

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

      {/* SEARCH */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">🔍 Search & Filter</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)' }}>
            {total} records
          </span>
        </div>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Text search */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 14 }}>⌕</span>
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              placeholder="Name, alias, ref ID, crime..."
              value={filters.query}
              onChange={e => update('query', e.target.value)}
            />
          </div>

          {/* Crime category */}
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.15em', marginBottom: 5 }}>
              CRIME CATEGORY
            </div>
            <select className="input select"
              value={filters.category}
              onChange={e => update('category', e.target.value)}>
              {CRIME_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Status */}
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.15em', marginBottom: 5 }}>
              STATUS
            </div>
            <select className="input select"
              value={filters.status}
              onChange={e => update('status', e.target.value)}>
              <option value="all">All Statuses</option>
              <option>Wanted</option>
              <option>Escaped</option>
              <option>Apprehended</option>
              <option>Convicted</option>
            </select>
          </div>

          {/* State */}
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.15em', marginBottom: 5 }}>
              STATE / REGION
            </div>
            <select className="input select"
              value={filters.state}
              onChange={e => update('state', e.target.value)}>
              {STATES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <button className="btn btn-ghost" style={{ justifyContent: 'center', marginTop: 4 }}
            onClick={() => setFilters({ query: '', category: 'All Categories', status: 'all', state: 'All States' })}>
            ✕ Clear Filters
          </button>
        </div>
      </div>

      {/* FACE SEARCH */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">🎯 Face Search</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--green)' }}>● AWS Rekognition</span>
        </div>
        <div className="panel-body">
          <div
            onClick={onFaceSearch}
            style={{
              border: '2px dashed var(--border2)', borderRadius: 2,
              padding: '20px 12px', textAlign: 'center', cursor: 'pointer',
              background: 'var(--surface2)', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(232,52,10,0.04)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--surface2)' }}
          >
            <div style={{ fontSize: 26, marginBottom: 8 }}>👤</div>
            <p style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', lineHeight: 1.6 }}>
              Upload photo for <span style={{ color: 'var(--accent)' }}>facial recognition</span> matching across all agency records
            </p>
            <p style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text3)', marginTop: 6 }}>
              Agency login required · JPG/PNG · max 5MB
            </p>
          </div>
        </div>
      </div>

      {/* ALERT SUBSCRIBE */}
      <div className="panel" style={{ background: 'rgba(232,52,10,0.03)', borderColor: 'rgba(232,52,10,0.18)' }}>
        <div className="panel-body" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>📲</div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 18, letterSpacing: '0.05em', marginBottom: 6 }}>ALERT SUBSCRIPTION</div>
          <p style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 12 }}>
            Push notifications for new warrants in your region via Firebase Cloud Messaging
          </p>
          <input className="input" type="email" placeholder="your@email.com" style={{ marginBottom: 8 }} />
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => alert('Subscription confirmed. You will receive alerts for new warrants.')}>
            Subscribe to Alerts
          </button>
        </div>
      </div>
    </aside>
  )
}
