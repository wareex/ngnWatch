import { useEffect, useState } from 'react'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { timeAgo } from '../utils/helpers'

function Counter({ target, duration = 1500, color }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / (duration / 16)
    const t = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(t) }
      else setVal(Math.floor(start))
    }, 16)
    return () => clearInterval(t)
  }, [target])
  return (
    <span style={{ fontFamily: 'var(--display)', fontSize: 36, letterSpacing: '0.05em', color: color || 'var(--text)' }}>
      {val.toLocaleString()}
    </span>
  )
}

const TICKER_ITEMS = [
  'NEW WARRANT · KANO STATE · ARMED ROBBERY · EFCC-2025-4821',
  'APPREHENDED · LAGOS · FRAUD SUSPECT · ICPC-2025-3309',
  'HIGH ALERT · INSURGENT SUSPECT · BORNO STATE · CONTACT DSS',
  'REWARD INCREASED ₦20M · KIDNAPPING · ABUJA FCT · NPF-2025-7734',
  'ESCAPED CUSTODY · BENIN · MEDIUM SECURITY · NCS-2025-0118',
  'NEW INTERPOL RED NOTICE ISSUED · FINANCIAL CRIMES · EFCC-2025-5002',
]

export default function Hero({ total, scrapedAt, usedSeed }) {
  const { isMobile } = useBreakpoint()

  return (
    <section style={{
      position: 'relative',
      background: 'linear-gradient(135deg,#0d1117 0%,#111318 50%,#0d1117 100%)',
      borderBottom: '1px solid var(--border)',
      overflow: 'hidden',
      padding: isMobile ? '1.75rem 0.875rem' : '3rem 1.25rem',
    }}>
      {/* BG watermark */}
      <div style={{
        position: 'absolute', left: -20, top: -20,
        fontFamily: 'var(--display)', fontSize: isMobile ? 120 : 220, color: 'rgba(232,52,10,0.03)',
        lineHeight: 1, pointerEvents: 'none', userSelect: 'none', letterSpacing: '0.05em',
      }}>NGA</div>

      <div style={{ maxWidth: 1400, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Live badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(232,52,10,0.1)', border: '1px solid rgba(232,52,10,0.3)',
          padding: '4px 12px', borderRadius: 2, marginBottom: '0.875rem',
        }}>
          <div className="pulse-dot" style={{ width: 6, height: 6 }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.2em' }}>
            {usedSeed ? 'DEMO DATA — CONNECT API FOR LIVE FEED' : `LIVE DATABASE — UPDATED ${timeAgo(scrapedAt)}`}
          </span>
        </div>

        <h1 style={{
          fontFamily: 'var(--display)',
          fontSize: 'clamp(36px,7vw,88px)',
          lineHeight: 0.95, letterSpacing: '0.05em', color: 'var(--text)',
          marginBottom: '0.875rem',
        }}>
          NIGERIAN<br />
          <span style={{ color: 'var(--accent)' }}>WANTED</span><br />
          CATALOGUE
        </h1>

        {!isMobile && (
          <p style={{ fontSize: 14, color: 'var(--text2)', maxWidth: 560, marginBottom: '1.25rem', lineHeight: 1.65, fontWeight: 300 }}>
            Unified law enforcement intelligence platform consolidating wanted persons published by EFCC, NPF, ICPC, and Ministry of Interior.
            Searchable by name, crime, agency, and state.
          </p>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', gap: isMobile ? '1.25rem' : '2.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <Stat num={<Counter target={total || 0} color="var(--accent)" />} label="Records" />
          <Stat num={<Counter target={Math.round((total || 0) * 0.61)} color="var(--gold)" duration={1200} />} label="Active Warrants" />
          <Stat num={<Counter target={Math.round((total || 0) * 0.28)} color="var(--green)" duration={1800} />} label="Apprehended" />
          <Stat num={<Counter target={4} />} label="Agencies" />
        </div>

        {/* Ticker */}
        <div style={{
          background: 'rgba(232,52,10,0.07)', border: '1px solid rgba(232,52,10,0.18)',
          padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 12,
          borderRadius: 2, overflow: 'hidden',
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.2em', flexShrink: 0 }}>
            ⚡ FEED
          </span>
          <div className="ticker-wrap">
            <div className="ticker-text" style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text2)' }}>
              {TICKER_ITEMS.join('   ·   ')}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Stat({ num, label }) {
  return (
    <div>
      <div style={{ lineHeight: 1 }}>{num}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.15em', marginTop: 3 }}>
        {label}
      </div>
    </div>
  )
}
