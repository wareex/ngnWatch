import { useWantedPersons } from '../hooks/useWantedPersons'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { AGENCIES } from '../utils/helpers'

const AGENCY_DETAILS = {
  efcc: {
    full: 'Economic & Financial Crimes Commission',
    icon: '🏛️', founded: '2003',
    mandate: 'Investigation and prosecution of financial crimes including advance fee fraud, money laundering, cybercrime, and other economic offences.',
    hotline: '0800-883-2679',
    crimes: ['Advance Fee Fraud', 'Money Laundering', 'Cybercrime', 'BEC Fraud', 'Asset Recovery'],
  },
  npf: {
    full: 'Nigeria Police Force',
    icon: '👮', founded: '1930',
    mandate: 'Maintenance of law and order, prevention and detection of crime, apprehension of offenders, and protection of rights of persons and property.',
    hotline: '199 / 112',
    crimes: ['Armed Robbery', 'Kidnapping', 'Murder', 'Terrorism', 'Drug Trafficking'],
  },
  icpc: {
    full: 'Independent Corrupt Practices & Other Related Offences Commission',
    icon: '⚖️', founded: '2000',
    mandate: 'Receiving, investigating, and prosecuting cases of corruption and related offences in both public and private sectors.',
    hotline: '0800-423-2672',
    crimes: ['Bribery', 'Embezzlement', 'Abuse of Office', 'Fraud', 'Diversion of Funds'],
  },
  interior: {
    full: 'Federal Ministry of Interior / Nigeria Immigration Service',
    icon: '🛃', founded: '1963',
    mandate: 'Control and regulation of immigration, nationality, and related matters. Enforcement of immigration and naturalization laws.',
    hotline: '08100046474',
    crimes: ['Illegal Entry', 'Document Forgery', 'Human Trafficking', 'Overstay', 'Identity Fraud'],
  },
}

export default function Agencies() {
  const { persons } = useWantedPersons()
  const { isMobile } = useBreakpoint()

  const counts = {}
  persons.forEach(p => { counts[p.agency] = (counts[p.agency] || 0) + 1 })

  const pad = isMobile ? '0.875rem' : '1.25rem'

  return (
    <div className="page-enter" style={{ maxWidth: 1400, margin: '0 auto', padding: `1.5rem ${pad}` }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.2em', marginBottom: 6 }}>
          PARTNER AGENCIES
        </div>
        <h1 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(28px,5vw,60px)', letterSpacing: '0.05em' }}>
          SOURCE <span style={{ color: 'var(--accent)' }}>AGENCIES</span>
        </h1>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)', marginTop: 8, maxWidth: 600, lineHeight: 1.6 }}>
          NGA-WATCH aggregates publicly published wanted persons data from 4 federal agencies.
          All data remains the intellectual property of the originating agency.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill,minmax(${isMobile ? '100%' : '300px'},1fr))`, gap: '1.25rem' }}>
        {AGENCIES.filter(a => a.id !== 'all').map(agency => {
          const detail = AGENCY_DETAILS[agency.id]
          const count = counts[agency.id] || 0

          return (
            <div key={agency.id} className="panel" style={{ overflow: 'visible' }}>
              <div style={{ padding: isMobile ? '16px' : '20px', borderBottom: '3px solid ' + agency.color }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: isMobile ? 26 : 32, marginBottom: 4 }}>{detail.icon}</div>
                    <div style={{ fontFamily: 'var(--display)', fontSize: isMobile ? 26 : 32, letterSpacing: '0.05em', color: agency.color }}>
                      {agency.label}
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.05em', lineHeight: 1.4, maxWidth: 240, marginTop: 2 }}>
                      {detail.full}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 36, color: agency.color }}>
                      {count}
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text3)', letterSpacing: '0.1em' }}>RECORDS</div>
                  </div>
                </div>

                <p style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text2)', lineHeight: 1.6 }}>
                  {detail.mandate}
                </p>
              </div>

              <div style={{ padding: isMobile ? '14px' : '16px' }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.15em', marginBottom: 8 }}>
                    PRIMARY CRIME TYPES
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {detail.crimes.map(c => (
                      <span key={c} style={{
                        fontFamily: 'var(--mono)', fontSize: 8, padding: '2px 7px', borderRadius: 1,
                        background: `${agency.color}15`, color: agency.color,
                        border: `1px solid ${agency.color}30`, letterSpacing: '0.06em',
                      }}>{c}</span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text3)', letterSpacing: '0.1em' }}>FOUNDED</div>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 18 }}>{detail.founded}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text3)', letterSpacing: '0.1em' }}>HOTLINE</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>{detail.hotline}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <a href={agency.url} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ flex: 1, justifyContent: 'center', fontSize: 9 }}>
                    Official Site ↗
                  </a>
                  <a href={`/?agency=${agency.id}`} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 9 }}>
                    View Records
                  </a>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* MOU Notice */}
      <div style={{
        marginTop: '1.5rem', padding: isMobile ? '16px' : '20px 24px',
        background: 'rgba(212,160,23,0.06)', border: '1px solid rgba(212,160,23,0.2)',
        borderRadius: 2,
      }}>
        <div style={{ fontFamily: 'var(--display)', fontSize: isMobile ? 18 : 22, color: 'var(--gold)', letterSpacing: '0.05em', marginBottom: 8 }}>
          DATA SOURCING NOTICE
        </div>
        <p style={{ fontFamily: 'var(--mono)', fontSize: isMobile ? 10 : 11, color: 'var(--text2)', lineHeight: 1.7, maxWidth: 800 }}>
          All records on NGA-WATCH are sourced exclusively from publicly published pages on official Nigerian government agency websites.
          This platform is an aggregator and search tool — no unpublished or classified data is accessed.
          All records remain the property of their originating agencies. NGA-WATCH operates under Nigeria's Freedom of Information Act 2011.
        </p>
      </div>
    </div>
  )
}
