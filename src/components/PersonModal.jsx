import { useEffect } from 'react'
import { getStatusInfo, formatDate } from '../utils/helpers'

export default function PersonModal({ person, onClose }) {
  useEffect(() => {
    const handleKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!person) return null
  const status = getStatusInfo(person.status)
  const initials = person.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        borderRadius: 'var(--radius)',
        maxWidth: 720, width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
        animation: 'page-in 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1,
        }}>
          <div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 26, letterSpacing: '0.05em' }}>
              {person.name.toUpperCase()}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
              {person.refId || `${person.agencyLabel} · ID PENDING`}
              {' · '}
              <a href={person.sourceUrl} target="_blank" rel="noreferrer"
                style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                SOURCE ↗
              </a>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 34, height: 34, background: 'none',
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            color: 'var(--text3)', cursor: 'pointer', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s', flexShrink: 0,
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text3)' }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>

          {/* LEFT — photo & status */}
          <div>
            <div style={{
              width: '100%', paddingBottom: '125%', position: 'relative',
              background: '#1a1e2a', borderRadius: 2, border: '1px solid var(--border2)',
              overflow: 'hidden', marginBottom: 12,
            }}>
              {person.imageUrl ? (
                <img src={person.imageUrl ? `https://wsrv.nl/?url=${encodeURIComponent(person.imageUrl)}&w=400&h=500&fit=cover&we` : ""} alt={person.name}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { if (e.target.src !== person.imageUrl) { e.target.src = person.imageUrl } else { e.target.style.display = "none" } }}
                />
              ) : (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 48, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.1em' }}>
                    {initials}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.15em' }}>
                    NO IMAGE
                  </div>
                </div>
              )}
            </div>

            <span className={`badge ${status.cls}`} style={{ display: 'block', textAlign: 'center', marginBottom: 10 }}>
              {status.label}
            </span>

            {person.reward && (
              <div style={{
                background: 'rgba(212,160,23,0.08)', border: '1px solid rgba(212,160,23,0.2)',
                padding: '10px 12px', borderRadius: 2, textAlign: 'center',
              }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text3)', letterSpacing: '0.15em', marginBottom: 4 }}>
                  REWARD OFFERED
                </div>
                <div style={{ fontFamily: 'var(--display)', fontSize: 24, color: 'var(--gold)', letterSpacing: '0.05em' }}>
                  {person.reward}
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.1em' }}>
                REPORTING AGENCY
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', background: 'var(--surface2)', borderRadius: 2,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: person.agencyColor, flexShrink: 0,
                  boxShadow: `0 0 6px ${person.agencyColor}`,
                }} />
                <div>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 16, letterSpacing: '0.05em' }}>
                    {person.agencyLabel}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text3)' }}>
                    {person.agency?.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — info blocks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <InfoBlock title="Criminal Record">
              <InfoRow k="Full Name" v={person.name} />
              {person.alias && <InfoRow k="Known Alias" v={`"${person.alias}"`} />}
              <InfoRow k="Crime(s)" v={person.crime || '—'} highlight />
              <InfoRow k="Status" v={person.status} />
              {person.refId && <InfoRow k="Reference ID" v={person.refId} mono />}
            </InfoBlock>

            <InfoBlock title="Last Known Location">
              <InfoRow k="State" v={person.state || 'Unknown'} />
              <InfoRow k="Intel Source" v="Published Government Record" />
              <InfoRow k="Coordinates" v="Withheld" />
            </InfoBlock>

            {person.description && (
              <InfoBlock title="Additional Information">
                <p style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text2)', lineHeight: 1.6 }}>
                  {person.description.slice(0, 400)}
                </p>
              </InfoBlock>
            )}

            <InfoBlock title="Record Metadata">
              <InfoRow k="Source" v={person.agencyLabel} />
              <InfoRow k="Scraped" v={formatDate(person.scrapedAt)} mono />
              {person.sourceUrl && (
                <InfoRow k="Source URL"
                  v={<a href={person.sourceUrl} target="_blank" rel="noreferrer"
                    style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 10 }}>
                    {person.agencyLabel} Official Site ↗
                  </a>}
                />
              )}
            </InfoBlock>

            {/* Warning */}
            <div style={{
              background: 'rgba(232,52,10,0.07)', border: '1px solid rgba(232,52,10,0.2)',
              padding: '12px 14px', borderRadius: 2,
              fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text2)', lineHeight: 1.6,
            }}>
              <strong style={{ color: 'var(--accent)' }}>⚠ DO NOT APPROACH.</strong>
              {' '}If you have information about this individual, contact the relevant agency directly or use the anonymous tip line: <strong style={{ color: 'var(--text)' }}>0800-NGA-WATCH</strong>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => alert('Tip submission: Your identity remains anonymous. A case reference will be issued. In an emergency, call 112.')}>
                📩 Submit Anonymous Tip
              </button>
              {person.sourceUrl && (
                <a href={person.sourceUrl} target="_blank" rel="noreferrer"
                  className="btn btn-outline">
                  Official Source ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoBlock({ title, children }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)',
        letterSpacing: '0.2em', textTransform: 'uppercase',
        borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 8,
      }}>{title}</div>
      {children}
    </div>
  )
}

function InfoRow({ k, v, highlight, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', gap: 12 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>{k}</span>
      <span style={{
        fontFamily: mono ? 'var(--mono)' : 'var(--sans)',
        fontSize: 10, fontWeight: 600,
        color: highlight ? 'var(--accent2)' : 'var(--text)',
        textAlign: 'right',
      }}>{v}</span>
    </div>
  )
}
