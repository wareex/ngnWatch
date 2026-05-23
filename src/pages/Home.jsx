import { useState, useMemo } from 'react'
import Hero from '../components/Hero'
import AgencyBar from '../components/AgencyBar'
import FilterSidebar from '../components/FilterSidebar'
import WantedCard from '../components/WantedCard'
import PersonModal from '../components/PersonModal'
import { useWantedPersons } from '../hooks/useWantedPersons'
import { filterPersons } from '../utils/helpers'

const SKELETON_COUNT = 8

export default function Home() {
  const { persons, loading, error, meta, refetch } = useWantedPersons()
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [activeAgency, setActiveAgency] = useState('all')
  const [filters, setFilters] = useState({
    query: '', category: 'All Categories', status: 'all', state: 'All States',
  })

  // Agency counts
  const agencyCounts = useMemo(() => {
    const counts = { all: persons.length }
    persons.forEach(p => { counts[p.agency] = (counts[p.agency] || 0) + 1 })
    return counts
  }, [persons])

  // Filtered results
  const filtered = useMemo(() =>
    filterPersons(persons, { ...filters, agency: activeAgency }),
    [persons, filters, activeAgency]
  )

  const handleAgencyChange = (id) => {
    setActiveAgency(id)
    if (id !== 'all') refetch(id)
    else refetch('all')
  }

  return (
    <div className="page-enter">
      <Hero total={meta.total} scrapedAt={meta.scrapedAt} usedSeed={meta.usedSeed} />

      <AgencyBar active={activeAgency} onChange={handleAgencyChange} counts={agencyCounts} />

      {/* Seed data warning */}
      {meta.usedSeed && (
        <div style={{
          background: 'rgba(212,160,23,0.07)', borderBottom: '1px solid rgba(212,160,23,0.2)',
          padding: '8px 2rem', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--gold)' }}>
            ⚠ DEMO MODE — Live agency scraping is unavailable. Displaying sample records.
            Deploy the serverless function and ensure internet access to load live data.
          </span>
          <button className="btn btn-ghost" style={{ fontSize: 9, padding: '4px 10px' }} onClick={() => refetch('all')}>
            Retry Live Data
          </button>
        </div>
      )}

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '2rem', display: 'grid', gridTemplateColumns: '268px 1fr', gap: '2rem' }}>
        <FilterSidebar
          filters={filters}
          setFilters={setFilters}
          total={filtered.length}
          onFaceSearch={() => alert('Face recognition requires agency-level login. Contact admin@ngawatch.gov.ng.')}
        />

        <div>
          {/* Results header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
              {loading
                ? 'Loading records...'
                : error
                  ? <span style={{ color: 'var(--accent)' }}>⚠ {error} — showing cached data</span>
                  : <><strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> records found · sorted by threat level</>
              }
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-outline" style={{ fontSize: 10, padding: '6px 12px' }}
                onClick={() => refetch(activeAgency)}>
                ↻ Refresh
              </button>
            </div>
          </div>

          {/* Critical banner */}
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
                  {filtered.filter(p => p.status === 'Wanted').length} individuals with active warrants. Do not approach — contact law enforcement immediately.
                </p>
              </div>
            </div>
          )}

          {/* Cards grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: '1rem' }}>
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <div key={i} style={{ borderRadius: 2, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <div className="skeleton" style={{ height: 180 }} />
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="skeleton" style={{ height: 20, width: '70%' }} />
                    <div className="skeleton" style={{ height: 12, width: '50%' }} />
                    <div className="skeleton" style={{ height: 10, width: '85%' }} />
                    <div className="skeleton" style={{ height: 10, width: '60%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <div style={{ fontFamily: 'var(--display)', fontSize: 24, color: 'var(--text2)', letterSpacing: '0.05em' }}>NO RECORDS FOUND</div>
              <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>Try adjusting your search or filters</p>
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
