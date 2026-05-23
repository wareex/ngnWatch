export const AGENCIES = [
  { id: 'all',      label: 'All Agencies', color: '#8892a4', dot: '#8892a4' },
  { id: 'efcc',     label: 'EFCC',         color: '#1976d2', dot: '#1976d2',
    full: 'Economic & Financial Crimes Commission',
    url: 'https://www.efcc.gov.ng/WantedPersons?page=1' },
  { id: 'npf',      label: 'NPF',          color: '#e8340a', dot: '#e8340a',
    full: 'Nigeria Police Force',
    url: 'https://www.npf.gov.ng/wanted' },
  { id: 'icpc',     label: 'ICPC',         color: '#d4a017', dot: '#d4a017',
    full: 'Independent Corrupt Practices Commission',
    url: 'https://icpc.gov.ng/wanted-persons/' },
  { id: 'interior', label: 'Interior',     color: '#00c853', dot: '#00c853',
    full: 'Ministry of Interior / NIS',
    url: 'https://interior.gov.ng/wanted-persons/' },
]

export const STATUS_MAP = {
  Wanted:      { label: 'WANTED',      cls: 'badge-wanted',     priority: 0 },
  Critical:    { label: '⚡ CRITICAL',  cls: 'badge-critical',   priority: 0 },
  Escaped:     { label: 'ESCAPED',     cls: 'badge-escaped',    priority: 1 },
  Apprehended: { label: '✓ APPREHENDED', cls: 'badge-apprehended', priority: 2 },
  Convicted:   { label: 'CONVICTED',   cls: 'badge-convicted',  priority: 3 },
}

export const CRIME_CATEGORIES = [
  'All Categories',
  'Terrorism & Insurgency',
  'Financial Fraud / 419',
  'Money Laundering',
  'Kidnapping & Abduction',
  'Drug Trafficking',
  'Armed Robbery',
  'Cybercrime',
  'Corruption & Bribery',
  'Human Trafficking',
  'Immigration Offence',
]

export const STATES = [
  'All States','Lagos','Abuja FCT','Kano','Rivers','Kaduna','Ogun',
  'Borno','Anambra','Delta','Oyo','Plateau','Benue','Edo','Imo',
  'Enugu','Adamawa','Akwa Ibom','Bauchi','Bayelsa','Benue','Cross River',
  'Ebonyi','Ekiti','Gombe','Jigawa','Kebbi','Kogi','Kwara','Nasarawa',
  'Niger','Osun','Ondo','Sokoto','Taraba','Yobe','Zamfara',
]

export function getStatusInfo(status) {
  return STATUS_MAP[status] || STATUS_MAP['Wanted']
}

export function getAgency(id) {
  return AGENCIES.find(a => a.id === id) || AGENCIES[0]
}

export function fuzzyMatch(text, query) {
  if (!query) return true
  return text.toLowerCase().includes(query.toLowerCase())
}

export function filterPersons(persons, { query, agency, status, state, category }) {
  return persons.filter(p => {
    if (agency && agency !== 'all' && p.agency !== agency) return false
    if (status && status !== 'all' && p.status !== status) return false
    if (state && state !== 'All States' && p.state !== state) return false
    if (category && category !== 'All Categories') {
      const cat = category.toLowerCase()
      if (!p.crime?.toLowerCase().includes(cat.split('/')[0].trim().toLowerCase())) return false
    }
    if (query) {
      const q = query.toLowerCase()
      return (
        p.name?.toLowerCase().includes(q) ||
        p.alias?.toLowerCase().includes(q) ||
        p.crime?.toLowerCase().includes(q) ||
        p.refId?.toLowerCase().includes(q) ||
        p.state?.toLowerCase().includes(q)
      )
    }
    return true
  })
}

export function timeAgo(iso) {
  if (!iso) return 'Unknown'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
