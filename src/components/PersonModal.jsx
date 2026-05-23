import { useEffect } from 'react'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { getStatusInfo, formatDate } from '../utils/helpers'

export default function PersonModal({ person, onClose }) {
  const { isMobile, isTablet } = useBreakpoint()

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
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
        padding: isMobile ? 0 : '1rem',
      }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        borderRadius: isMobile ? '8px 8px 0 0' : 'var(--radius)',
        width: '100%',
        maxWidth: isMobile ? '100%' : 720,
        maxHeight: isMobile ? '92vh' : '90vh',
        overflowY: 'auto',
        animation: 'page-in 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: isMobile ? '14px 16px' : '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--display)', fontSize: isMobile ? 20 : 26, letterSpacing: '0.05em', lineHeight: 1.1 }}>
              {person.name.toUpperCase()}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', marginTop: 3 }}>
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
            transition: 'all 0.2s', flexShrink: 0, marginLeft: 12,
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text3)' }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{
          padding: isMobile ? '14px 16px' : 20,
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '200px 1fr',
          gap: isMobile ? 16 : 20,
        }}>

          {/* LEFT — photo & status */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: 12, alignItems: isMobile ? 'flex-start' : 'stretch' }}>
            {/* Photo */}
            <div style={{
              width: isMobile ? 100 : '100%',
              paddingBottom: isMobile ? 0 : '125%',
              height: isMobile ? 125 : 0,
              position: 'relative',
              background: '#1a1e2a', borderRadius: 2, border: '1px solid var(--border2)',
              overflow: 'hidden', flexShrink: 0,
            }}>
              {person.imageUrl ? (
                <img
                  src={`https://wsrv.nl/?url=${encodeURIComponent(person.imageUrl)}&w=400&h=500&fit=cover&we`}
                  alt={person.name}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { if (!e.target.dataset.fb) { e.target.dataset.fb = "1"; e.target.src = person.imageUrl } else { e.target.style.display = "none" } }}
                />
              ) : (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ fontFamily: 'var(--display)', fontSize: isMobile ? 28 : 48, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.1em' }}>
                    {initials}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.15em' }}>
                    NO IMAGE
                  </div>
                </div>
              )}
            </div>

            {/* Status + agency (mobile: side by side with photo) */}
            <div style={{ flex: isMobile ? 1 : 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className={`badge ${status.cls}`} style={{ display: 'block', textAlign: 'center' }}>
                {status.label}
              </span>

              {person.reward && (
                <div style={{
                  background: 'rgba(212,160,23,0.08)', border: '1px solid rgba(212,160,23,0.2)',
                  padding: '8px 10px', borderRadius: 2, textAlign: 'center',
                }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text3)', letterSpacing: '0.15em', marginBottom: 3 }}>
                    REWARD OFFERED
                  </div>
                  <div style={{ fontFamily: 'var(--display)', fontSize: isMobile ? 18 : 22, color: 'var(--gold)', letterSpacing: '0.05em' }}>
                    {person.reward}
                  </div>
                </div>
              )}

              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', background: 'var(--surface2)', borderRadius: 2,
              }}>
                <div style={{
                  width: 9, height: 9, borderRadius: '50%',
                  background: person.agencyColor, flexShrink: 0,
                  boxShadow: `0 0 6px ${person.agencyColor}`,
                }} />
                <div>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 14, letterSpacing: '0.05em' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

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

            <div style={{
              background: 'rgba(232,52,10,0.07)', border: '1px solid rgba(232,52,10,0.2)',
              padding: '10px 12px', borderRadius: 2,
              fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text2)', lineHeight: 1.6,
            }}>
              <strong style={{ color: 'var(--accent)' }}>⚠ DO NOT APPROACH.</strong>
              {' '}If you have information, contact the relevant agency or call{' '}
              <strong style={{ color: 'var(--text)' }}>0800-NGA-WATCH</strong>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', minWidth: 140 }}
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
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>{k}</span>
      <span style={{
        fontFamily: mono ? 'var(--mono)' : 'var(--sans)',
        fontSize: 10, fontWeight: 600,
        color: highlight ? 'var(--accent2)' : 'var(--text)',
        textAlign: 'right', flex: 1,
      }}>{v}</span>
    </div>
  )
}
