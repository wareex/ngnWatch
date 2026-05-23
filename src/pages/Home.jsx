import { useState, useMemo, useEffect, useRef } from 'react'
import Hero from '../components/Hero'
import AgencyBar from '../components/AgencyBar'
import FilterSidebar from '../components/FilterSidebar'
import WantedCard from '../components/WantedCard'
import PersonModal from '../components/PersonModal'
import { useWantedPersons } from '../hooks/useWantedPersons'
import { filterPersons, timeAgo, formatDate } from '../utils/helpers'

const SKELETON_COUNT = 8

export default function Home() {
  const { persons, loading, refreshing, error, meta, lastFetched, refetch, forceRefetch } =
    useWantedPersons('all')

  const [selectedPerson, setSelectedPerson]   = useState(null)
  const [activeAgency, setActiveAgency]       = useState('all')
  const [filters, setFilters]                 = useState({
    query: '', category: 'All Categories', status: 'all', state: 'All States',
  })
  const [countdown, setCountdown]             = useState(null)
  const timerRef                              = useRef(null)

  // ── Countdown clock to next auto-refresh ──────────────────────────────────
  useEffect(() => {
    if (!lastFetched) return
    clearInterval(timerRef.current)
    const nextAt = lastFetched.getTime() + (meta.nextRefreshIn || 30 * 60 * 1000)
    timerRef.current = setInterval(() => {
      const secsLeft = Math.max(0, Math.floor((nextAt - Date.now()) / 1000))
      const m = String(Math.floor(secsLeft / 60)).padStart(2, '0')
      const s = String(secsLeft % 60).padStart(2, '0')
      setCountdown(`${m}:${s}`)
      if (secsLeft === 0) clearInterval(timerRef.current)
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [lastFetched, meta.nextRefreshIn])

  // ── Agency counts ──────────────────────────────────────────────────────────
  const agencyCounts = useMemo(() => {
    const counts = { all: persons.length }
    persons.forEach(p => { counts[p.agency] = (counts[p.agency] || 0) + 1 })
    return counts
  }, [persons])

  // ── Filtered results ───────────────────────────────────────────────────────
  const filtered = useMemo(
    () => filterPersons(persons, { ...filters, agency: activeAgency }),
    [persons, filters, activeAgency]
  )

  const handleAgencyChange = (id) => {
    setActiveAgency(id)
    refetch(id)
  }

  const isStale = meta.scrapedAt &&
    Date.now() - new Date(meta.scrapedAt).getTime() > 60 * 60 * 1000 // > 1 hr

  return (
    <div className="page-enter">
      <Hero total={meta.total} scrapedAt={meta.scrapedAt} usedSeed={meta.usedSeed} />

      <AgencyBar active={activeAgency} onChange={handleAgencyChange} counts={agencyCounts} />

      {/* ── Status Bar ─────────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        padding: '6px 2rem',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        background: 'var(--surface)',
      }}>
        {/* Live / Demo indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: meta.usedSeed ? 'var(--gold)' : 'var(--green)',
            boxShadow: meta.usedSeed ? '0 0 5px var(--gold)' : '0 0 5px var(--green)',
            display: 'inline-block',
            animation: refreshing ? 'pulse 1s infinite' : 'none',
          }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: meta.usedSeed ? 'var(--gold)' : 'var(--green)' }}>
            {meta.usedSeed ? 'DEMO MODE' : 'LIVE DATA'}
          </span>
        </div>

        {/* Scraped at */}
        {meta.scrapedAt && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)' }}>
            Scraped: {formatDate(meta.scrapedAt)}
            {isStale && <span style={{ color: 'var(--gold)', marginLeft: 6 }}>⚠ STALE</span>}
          </span>
        )}

        {/* Cache indicator */}
        {meta.cacheHit && !meta.usedSeed && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)' }}>
            · Served from cache
          </span>
        )}

        {/* Countdown */}
        {countdown && !meta.usedSeed && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)' }}>
            · Next refresh in <span style={{ color: 'var(--text2)' }}>{countdown}</span>
          </span>
        )}

        {/* Refreshing spinner */}
        {refreshing && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--accent2)', marginLeft: 'auto' }}>
            ↻ Refreshing…
          </span>
        )}

        {/* Per-agency live stats */}
        {!meta.usedSeed && Object.keys(meta.agencyStats).length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {Object.entries(meta.agencyStats).map(([ag, stat]) => (
              <span key={ag} style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--text3)' }}>
                {ag.toUpperCase()}: <span style={{ color: stat.count > 0 ? 'var(--green)' : 'var(--gold)' }}>
                  {stat.count} records
                </span>
                {stat.source === 'cache' && ' (cached)'}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Demo / error banner ────────────────────────────────────────────── */}
      {(meta.usedSeed || error) && (
        <div style={{
          background: 'rgba(212,160,23,0.07)',
          borderBottom: '1px solid rgba(212,160,23,0.2)',
          padding: '8px 2rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--gold)', flex: 1 }}>
            {error
              ? `⚠ Scraper error: ${error} — showing demo records.`
              : '⚠ DEMO MODE — Live agency scraping unavailable. Deploy the serverless function to load live data.'}
          </span>
          <button className="btn btn-ghost" style={{ fontSize: 9, padding: '4px 10px' }}
            onClick={() => refetch(activeAgency)}>
            ↻ Retry
          </button>
          <button className="btn btn-outline" style={{ fontSize: 9, padding: '4px 10px' }}
            onClick={() => forceRefetch(activeAgency)}>
            ⚡ Force Re-scrape
          </button>
        </div>
      )}

      {/* ── Main Layout ───────────────────────────────────────────────────── */}
      <main style={{
        maxWidth: 1400, margin: '0 auto', padding: '2rem',
        display: 'grid', gridTemplateColumns: '268px 1fr', gap: '2rem',
      }}>
        <FilterSidebar
          filters={filters}
          setFilters={setFilters}
          total={filtered.length}
          onFaceSearch={() => alert('Face recognition requires agency-level login.')}
        />

        <div>
          {/* Results header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '1rem', flexWrap: 'wrap', gap: 8,
          }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
              {loading
                ? 'Loading records…'
                : error && persons.length === 0
                  ? <span style={{ color: 'var(--accent)' }}>⚠ {error}</span>
                  : <>
                      <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> records
                      {filtered.length !== persons.length && ` (filtered from ${persons.length})`}
                      {' · '}sorted by threat level
                      {lastFetched && (
                        <span style={{ color: 'var(--text3)', marginLeft: 8 }}>
                          · updated {timeAgo(lastFetched.toISOString())}
                        </span>
                      )}
                    </>
              }
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 10, padding: '6px 12px' }}
                disabled={loading || refreshing}
                onClick={() => refetch(activeAgency)}
              >
                {refreshing ? '↻ Refreshing…' : '↻ Refresh'}
              </button>
              <button
                className="btn btn-outline"
                style={{ fontSize: 10, padding: '6px 12px' }}
                disabled={loading || refreshing}
                onClick={() => forceRefetch(activeAgency)}
                title="Force re-scrape — bypasses server cache"
              >
                ⚡ Force Update
              </button>
            </div>
          </div>

          {/* High-priority alert banner */}
          {!loading && filtered.some(p => p.status === 'Wanted' && p.reward) && (
            <div style={{
              background: 'rgba(232,52,10,0.08)', border: '1px solid rgba(232,52,10,0.3)',
              borderRadius: 2, padding: '12px 16px', marginBottom: '1rem',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>🚨</span>
              <div>
                <div style={{ fontFamily: 'var(--display)', fontSize: 18, color: 'var(--accent)', letterSpacing: '0.05em' }}>
                  HIGH-PRIORITY WARRANTS ACTIVE
                </div>
                <p style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text2)', marginTop: 2 }}>
                  {filtered.filter(p => p.status === 'Wanted').length} individuals with active warrants.
                  Do not approach — contact law enforcement immediately.
                </p>
              </div>
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: '1rem' }}>
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <div key={i} style={{ borderRadius: 2, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <div className="skeleton" style={{ height: 180 }} />
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="skeleton" style={{ height: 20, width: '70%' }} />
                    <div className="skeleton" style={{ height: 12, width: '50%' }} />
                    <div className="skeleton" style={{ height: 10, width: '85%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <div style={{ fontFamily: 'var(--display)', fontSize: 24, color: 'var(--text2)', letterSpacing: '0.05em' }}>
                NO RECORDS FOUND
              </div>
              <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: '1rem' }}>
              {filtered.map(person => (
                <WantedCard key={person.id} person={person} onClick={setSelectedPerson} />
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedPerson && <PersonModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />}
    </div>
  )
}
