/**
 * useWantedPersons v2
 *
 * Features:
 *  - Auto-refresh every POLL_INTERVAL ms (default 30 min, matching server cache TTL)
 *  - Manual refresh with force-cache-bust option
 *  - Per-agency filtering hits the API selectively
 *  - Exposes: persons, loading, refreshing, error, meta, lastFetched, refetch, forceRefetch
 *  - Shows staleness indicator based on scrapedAt timestamp
 */
import { useState, useEffect, useRef, useCallback } from 'react'

const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8888/.netlify/functions/scrape'
    : '/.netlify/functions/scrape')

// How often to auto-refresh (matches server-side cache TTL: 30 min)
const POLL_INTERVAL = 30 * 60 * 1000

// Client-side cache so switching agencies doesn't re-fetch unnecessarily
const _clientCache = {}
const CLIENT_CACHE_TTL = 5 * 60 * 1000 // 5 min client-side

function clientCacheGet(key) {
  const e = _clientCache[key]
  if (!e) return null
  if (Date.now() - e.ts > CLIENT_CACHE_TTL) { delete _clientCache[key]; return null }
  return e.data
}
function clientCacheSet(key, data) { _clientCache[key] = { ts: Date.now(), data } }

export function useWantedPersons(initialAgency = 'all') {
  const [persons, setPersons]       = useState([])
  const [loading, setLoading]       = useState(true)   // first load
  const [refreshing, setRefreshing] = useState(false)  // background refresh
  const [error, setError]           = useState(null)
  const [meta, setMeta]             = useState({
    total: 0, usedSeed: false, scrapedAt: null,
    cacheHit: false, nextRefreshIn: POLL_INTERVAL,
    agencyStats: {},
  })
  const [lastFetched, setLastFetched] = useState(null)
  const timerRef = useRef(null)

  const doFetch = useCallback(async (agency = 'all', { bust = false, background = false } = {}) => {
    if (background) setRefreshing(true)
    else setLoading(true)
    setError(null)

    // Check client cache first (unless busting)
    const cacheKey = `agency:${agency}`
    if (!bust) {
      const cached = clientCacheGet(cacheKey)
      if (cached) {
        setPersons(cached.persons)
        setMeta(cached.meta)
        setLastFetched(new Date(cached.fetchedAt))
        setLoading(false)
        setRefreshing(false)
        return
      }
    }

    try {
      const qs = new URLSearchParams({ agency })
      if (bust) qs.set('nocache', '1')
      const res = await fetch(`${API_URL}?${qs}`)
      if (!res.ok) throw new Error(`API returned HTTP ${res.status}`)
      const data = await res.json()

      const newMeta = {
        total:         data.total        ?? 0,
        usedSeed:      data.usedSeed     ?? false,
        scrapedAt:     data.scrapedAt    ?? null,
        cacheHit:      data.cacheHit     ?? false,
        nextRefreshIn: data.nextRefreshIn ?? POLL_INTERVAL,
        agencyStats:   data.agencyStats  ?? {},
      }

      setPersons(data.persons || [])
      setMeta(newMeta)
      setLastFetched(new Date())

      clientCacheSet(cacheKey, {
        persons: data.persons || [],
        meta: newMeta,
        fetchedAt: Date.now(),
      })
    } catch (err) {
      setError(err.message)
      if (persons.length === 0) setPersons(INLINE_SEED)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Initial fetch + auto-refresh timer
  useEffect(() => {
    doFetch(initialAgency)

    timerRef.current = setInterval(() => {
      doFetch(initialAgency, { background: true })
    }, POLL_INTERVAL)

    return () => clearInterval(timerRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Manual refresh — keeps current results visible, shows spinner */
  const refetch = useCallback((agency = 'all') => {
    doFetch(agency, { background: persons.length > 0 })
  }, [doFetch, persons.length])

  /** Force-busts the server cache and re-scrapes all sources */
  const forceRefetch = useCallback((agency = 'all') => {
    // Invalidate client cache too
    Object.keys(_clientCache).forEach(k => delete _clientCache[k])
    doFetch(agency, { bust: true, background: persons.length > 0 })
  }, [doFetch, persons.length])

  return { persons, loading, refreshing, error, meta, lastFetched, refetch, forceRefetch }
}

// ─── Inline seed shown when the API is completely unreachable ──────────────────
const INLINE_SEED = [
  { id:'s1', name:'Terwase Agwaza', alias:'Gana', crime:'Terrorism / Mass Murder / Armed Robbery', status:'Wanted', reward:'₦20,000,000', state:'Benue', agency:'npf', agencyLabel:'NPF', agencyColor:'#e8340a', imageUrl:null, refId:'NPF-2025-4410', sourceUrl:'https://www.npf.gov.ng/wanted', scrapedAt:new Date().toISOString() },
  { id:'s2', name:'Emmanuel Nwude', alias:'The Governor', crime:'Advance Fee Fraud (₦12.4B)', status:'Wanted', reward:'₦5,000,000', state:'Anambra', agency:'efcc', agencyLabel:'EFCC', agencyColor:'#1976d2', imageUrl:null, refId:'EFCC-2025-0091', sourceUrl:'https://www.efcc.gov.ng/WantedPersons', scrapedAt:new Date().toISOString() },
  { id:'s3', name:'Abdulrasheed Maina', alias:null, crime:'Pension Fraud / Money Laundering', status:'Convicted', reward:null, state:'Abuja FCT', agency:'icpc', agencyLabel:'ICPC', agencyColor:'#d4a017', imageUrl:null, refId:'ICPC-2021-0078', sourceUrl:'https://icpc.gov.ng/wanted-persons/', scrapedAt:new Date().toISOString() },
  { id:'s4', name:'Chukwudumeme Onwuamadike', alias:'Evans', crime:'Kidnapping / Armed Robbery', status:'Apprehended', reward:null, state:'Lagos', agency:'npf', agencyLabel:'NPF', agencyColor:'#e8340a', imageUrl:null, refId:'NPF-2017-0112', sourceUrl:'https://www.npf.gov.ng/wanted', scrapedAt:new Date().toISOString() },
  { id:'s5', name:'Ramon Olorunwa Abbas', alias:'Hushpuppi', crime:'Wire Fraud / Money Laundering', status:'Convicted', reward:null, state:'Lagos', agency:'efcc', agencyLabel:'EFCC', agencyColor:'#1976d2', imageUrl:null, refId:'EFCC-2020-0043', sourceUrl:'https://www.efcc.gov.ng/WantedPersons', scrapedAt:new Date().toISOString() },
  { id:'s6', name:'Joshua Dariye', alias:null, crime:'Corruption / Diversion of Public Funds', status:'Convicted', reward:null, state:'Plateau', agency:'icpc', agencyLabel:'ICPC', agencyColor:'#d4a017', imageUrl:null, refId:'ICPC-2019-0034', sourceUrl:'https://icpc.gov.ng/wanted-persons/', scrapedAt:new Date().toISOString() },
]
