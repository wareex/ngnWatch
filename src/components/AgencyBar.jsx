import { AGENCIES } from '../utils/helpers'

export default function AgencyBar({ active, onChange, counts = {} }) {
  return (
    <div style={{
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      padding: '0.6rem 2rem',
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.2em', marginRight: 4 }}>
          FILTER BY AGENCY:
        </span>
        {AGENCIES.map(a => {
          const isActive = active === a.id
          return (
            <button
              key={a.id}
              onClick={() => onChange(a.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 2, cursor: 'pointer',
                fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
                border: `1px solid ${isActive ? a.color : 'var(--border2)'}`,
                color: isActive ? 'var(--text)' : 'var(--text2)',
                background: isActive ? `${a.color}18` : 'transparent',
                transition: 'all 0.18s',
              }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: a.color,
                boxShadow: isActive ? `0 0 5px ${a.color}` : 'none',
              }} />
              {a.label}
              {counts[a.id] !== undefined && (
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 9,
                  color: isActive ? a.color : 'var(--text3)',
                }}>({counts[a.id]})</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
