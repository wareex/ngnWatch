import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function Header({ alertCount = 0 }) {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(10,12,16,0.96)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
      padding: '0 2rem',
    }}>
      <div style={{
        maxWidth: 1400, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 64,
      }}>
        {/* LOGO */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <div style={{
            width: 36, height: 36,
            background: 'var(--accent)',
            clipPath: 'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--display)', fontSize: 13, color: '#fff',
            animation: 'pulse-dot 2s ease-in-out infinite',
          }}>NW</div>
          <div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 22, letterSpacing: '0.1em', color: 'var(--text)' }}>
              NGA-WATCH
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text3)', letterSpacing: '0.18em', marginTop: -3 }}>
              CRIMINAL WANTED CATALOGUE · v2.5
            </div>
          </div>
        </Link>

        {/* NAV */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {[
            { to: '/',          label: 'Database' },
            { to: '/agencies',  label: 'Agencies' },
            { to: '/map',       label: 'Map' },
            { to: '/submit',    label: 'Submit Tip' },
          ].map(({ to, label }) => (
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
      </div>
    </header>
  )
}
