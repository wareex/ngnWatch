import { getStatusInfo } from '../utils/helpers'

const PLACEHOLDER_COLORS = ['#1a1e2a','#1e1a2a','#1a2a1e','#2a1a1a']

export default function WantedCard({ person, onClick }) {
  const status = getStatusInfo(person.status)
  const isCritical = person.status === 'Critical' || person.status === 'Wanted'
  const isApprehended = person.status === 'Apprehended' || person.status === 'Convicted'

  const initials = person.name.split(' ')
    .map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div
      onClick={() => onClick(person)}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${isCritical && !isApprehended ? 'var(--border)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        overflow: 'hidden', cursor: 'pointer',
        transition: 'all 0.25s',
        opacity: isApprehended ? 0.75 : 1,
        position: 'relative',
      }}
      className="wanted-card"
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.borderColor = isCritical && !isApprehended
          ? 'var(--accent)' : 'var(--border2)'
        e.currentTarget.style.boxShadow = isCritical && !isApprehended
          ? '0 8px 32px rgba(232,52,10,0.15)' : '0 8px 24px rgba(0,0,0,0.4)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.boxShadow = ''
      }}
    >
      {/* IMAGE */}
      <div style={{
        position: 'relative', height: 180,
        background: PLACEHOLDER_COLORS[Math.abs(person.name.charCodeAt(0)) % 4],
        overflow: 'hidden',
      }}>
        {person.imageUrl ? (
          <img
            src={person.imageUrl} alt={person.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(15%)' }}
            onError={e => { e.target.style.display = 'none' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 8,
          }}>
            <div style={{
              width: 70, height: 70, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--display)', fontSize: 28, color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.1em',
            }}>{initials}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.15em' }}>
              NO PHOTO
            </div>
          </div>
        )}

        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(10,12,16,0.9) 0%, transparent 55%)',
        }} />

        {/* Status badge */}
        <span className={`badge ${status.cls}`} style={{ position: 'absolute', top: 10, right: 10 }}>
          {status.label}
        </span>

        {/* Reward */}
        {person.reward && (
          <div style={{ position: 'absolute', bottom: 10, left: 12 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'rgba(212,160,23,0.8)', letterSpacing: '0.15em' }}>REWARD</div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 20, color: 'var(--gold)', letterSpacing: '0.05em' }}>
              {person.reward}
            </div>
          </div>
        )}

        {/* Agency dot */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          width: 8, height: 8, borderRadius: '50%',
          background: person.agencyColor || 'var(--text3)',
          boxShadow: `0 0 6px ${person.agencyColor || 'transparent'}`,
        }} />
      </div>

      {/* BODY */}
      <div style={{ padding: '14px 14px 10px' }}>
        <div style={{ fontFamily: 'var(--display)', fontSize: 20, letterSpacing: '0.05em', lineHeight: 1, marginBottom: 3 }}>
          {person.name.toUpperCase()}
        </div>
        {person.alias && (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', marginBottom: 10, letterSpacing: '0.05em' }}>
            AKA "{person.alias}"
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {person.refId && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)' }}>REF</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text2)' }}>{person.refId}</span>
            </div>
          )}
          {person.state && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)' }}>STATE</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text2)' }}>{person.state}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 8, padding: '2px 6px', borderRadius: 1,
            background: 'rgba(232,52,10,0.12)', color: 'var(--accent)',
            border: '1px solid rgba(232,52,10,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            {(person.crime || 'Unknown').split('/')[0].trim().slice(0, 22)}
          </span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 8, padding: '2px 6px', borderRadius: 1,
            background: `${person.agencyColor}1a`,
            color: person.agencyColor || 'var(--text2)',
            border: `1px solid ${person.agencyColor}40`,
            letterSpacing: '0.08em',
          }}>
            {person.agencyLabel}
          </span>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{
        padding: '9px 14px', borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)' }}>
          {person.state || 'Location unknown'}
        </span>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--accent)',
          letterSpacing: '0.08em', cursor: 'pointer',
        }}>
          VIEW →
        </span>
      </div>
    </div>
  )
}
