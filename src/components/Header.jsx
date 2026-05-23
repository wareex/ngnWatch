import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useBreakpoint } from '../hooks/useBreakpoint'

const NAV_LINKS = [
  { to: '/',         label: 'Database'   },
  { to: '/agencies', label: 'Agencies'  },
  { to: '/map',      label: 'Map'        },
  { to: '/submit',   label: 'Submit Tip' },
]

export default function Header({ alertCount = 0 }) {
  const { pathname } = useLocation()
  const { isTablet } = useBreakpoint()
  const [menuOpen, setMenuOpen] = useState(false)

  const close = () => setMenuOpen(false)

  return (
    <>
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10,12,16,0.96)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 1.25rem',
      }}>
        <div style={{
          maxWidth: 1400, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 64,
        }}>
          {/* LOGO */}
          <Link to="/" onClick={close} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
            <div style={{
              width: 34, height: 34,
              background: 'var(--accent)',
              clipPath: 'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--display)', fontSize: 12, color: '#fff',
              animation: 'pulse-dot 2s ease-in-out infinite',
              flexShrink: 0,
            }}>NW</div>
            <div>
              <div style={{ fontFamily: 'var(--display)', fontSize: isTablet ? 18 : 22, letterSpacing: '0.1em', color: 'var(--text)', lineHeight: 1 }}>
                NGA-WATCH
              </div>
              {!isTablet && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text3)', letterSpacing: '0.18em', marginTop: 1 }}>
                  CRIMINAL WANTED CATALOGUE · v2.5
                </div>
              )}
            </div>
          </Link>

          {/* DESKTOP NAV */}
          <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {NAV_LINKS.map(({ to, label }) => (
              <Link key={to} to={to} style={{
                fontFamily: 'var(--mono)', fontSize: 11,
                color: pathname === to ? 'var(--accent)' : 'var(--text2)',
                textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase',
                transition: 'color 0.2s',
              }}>{label}</Link>
            ))}

            {alertCount > 0 && (
              <button className="btn btn-outline" style={{ gap: 6 }}
                onClick={() => window.dispatchEvent(new CustomEvent('show-alerts'))}>
                <div className="pulse-dot" style={{ flexShrink: 0 }} />
                Live Alerts
                <span style={{
                  background: 'var(--accent)', color: '#fff',
                  borderRadius: 10, padding: '1px 6px',
                  fontFamily: 'var(--mono)', fontSize: 9,
                }}>{alertCount}</span>
              </button>
            )}

            <a href="#agency-login" className="btn btn-primary">Agency Login</a>
          </nav>

          {/* MOBILE RIGHT — alert dot + hamburger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {alertCount > 0 && (
              <button
                className="btn btn-outline"
                style={{ padding: '6px 10px', gap: 6, display: isTablet ? 'inline-flex' : 'none' }}
                onClick={() => window.dispatchEvent(new CustomEvent('show-alerts'))}
              >
                <div className="pulse-dot" style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9 }}>{alertCount}</span>
              </button>
            )}

            <button
              className={`hamburger${menuOpen ? ' open' : ''}`}
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle navigation"
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE SLIDE-DOWN NAV */}
      <nav className={`mobile-nav${menuOpen ? ' open' : ''}`}>
        {NAV_LINKS.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            onClick={close}
            className={`mobile-nav-link${pathname === to ? ' active' : ''}`}
          >
            {label}
            <span style={{ color: 'var(--text3)', fontSize: 14 }}>›</span>
          </Link>
        ))}

        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a href="#agency-login" onClick={close} className="btn btn-primary" style={{ justifyContent: 'center', padding: '13px' }}>
            Agency Login
          </a>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '2rem', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', lineHeight: 1.7 }}>
          Emergency: <strong style={{ color: 'var(--text)' }}>112</strong>&nbsp;&nbsp;·&nbsp;&nbsp;
          EFCC: <strong style={{ color: 'var(--text)' }}>0800-883-2679</strong>&nbsp;&nbsp;·&nbsp;&nbsp;
          Police: <strong style={{ color: 'var(--text)' }}>199</strong>
        </div>
      </nav>
    </>
  )
}
