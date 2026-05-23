/**
 * useWantedPersons
 * Fetches wanted persons from the serverless scrape endpoint.
 * Works on both Netlify (/.netlify/functions/scrape) and Vercel (/api/scrape).
 */
import { useState, useEffect, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8888/.netlify/functions/scrape'
    : '/api/scrape')

export function useWantedPersons() {
  const [persons, setPersons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [meta, setMeta] = useState({ total: 0, usedSeed: false, scrapedAt: null })
  const [lastFetched, setLastFetched] = useState(null)

  const fetch_ = useCallback(async (agency = 'all') => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}?agency=${agency}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPersons(data.persons || [])
      setMeta({ total: data.total, usedSeed: data.usedSeed, scrapedAt: data.scrapedAt })
      setLastFetched(new Date())
    } catch (err) {
      setError(err.message)
      // Load seed data inline so the UI still shows something
      setPersons(INLINE_SEED)
      setMeta({ total: INLINE_SEED.length, usedSeed: true, scrapedAt: new Date().toISOString() })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  return { persons, loading, error, meta, lastFetched, refetch: fetch_ }
}

// ─── Inline seed shown when the API is unreachable (e.g. local dev without the function) ───
const INLINE_SEED = [
  {
    id: 's1', name: 'Terwase Agwaza', alias: 'Gana',
    crime: 'Terrorism / Mass Murder / Armed Robbery', status: 'Wanted',
    reward: '₦20,000,000', state: 'Benue', agency: 'npf', agencyLabel: 'NPF',
    agencyColor: '#e8340a', imageUrl: null, refId: 'NPF-2025-4410',
    sourceUrl: 'https://www.npf.gov.ng/wanted',
    scrapedAt: new Date().toISOString(),
  },
  {
    id: 's2', name: 'Emmanuel Nwude', alias: 'The Governor',
    crime: 'Advance Fee Fraud (₦12.4B)', status: 'Wanted',
    reward: '₦5,000,000', state: 'Anambra', agency: 'efcc', agencyLabel: 'EFCC',
    agencyColor: '#1976d2', imageUrl: null, refId: 'EFCC-2025-0091',
    sourceUrl: 'https://www.efcc.gov.ng/WantedPersons',
    scrapedAt: new Date().toISOString(),
  },
  {
    id: 's3', name: 'Abdulrasheed Maina', alias: null,
    crime: 'Pension Fraud / Money Laundering', status: 'Convicted',
    reward: null, state: 'Abuja FCT', agency: 'icpc', agencyLabel: 'ICPC',
    agencyColor: '#d4a017', imageUrl: null, refId: 'ICPC-2021-0078',
    sourceUrl: 'https://icpc.gov.ng/wanted-persons/',
    scrapedAt: new Date().toISOString(),
  },
  {
    id: 's4', name: 'Chukwudumeme Onwuamadike', alias: 'Evans',
    crime: 'Kidnapping / Armed Robbery', status: 'Apprehended',
    reward: null, state: 'Lagos', agency: 'npf', agencyLabel: 'NPF',
    agencyColor: '#e8340a', imageUrl: null, refId: 'NPF-2017-0112',
    sourceUrl: 'https://www.npf.gov.ng/wanted',
    scrapedAt: new Date().toISOString(),
  },
  {
    id: 's5', name: 'Ramon Olorunwa Abbas', alias: 'Hushpuppi',
    crime: 'Wire Fraud / Money Laundering', status: 'Convicted',
    reward: null, state: 'Lagos', agency: 'efcc', agencyLabel: 'EFCC',
    agencyColor: '#1976d2', imageUrl: null, refId: 'EFCC-2020-0043',
    sourceUrl: 'https://www.efcc.gov.ng/WantedPersons',
    scrapedAt: new Date().toISOString(),
  },
  {
    id: 's6', name: 'Joshua Dariye', alias: null,
    crime: 'Corruption / Diversion of Public Funds', status: 'Convicted',
    reward: null, state: 'Plateau', agency: 'icpc', agencyLabel: 'ICPC',
    agencyColor: '#d4a017', imageUrl: null, refId: 'ICPC-2019-0034',
    sourceUrl: 'https://icpc.gov.ng/wanted-persons/',
    scrapedAt: new Date().toISOString(),
  },
]
