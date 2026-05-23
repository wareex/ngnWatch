import { useWantedPersons } from '../hooks/useWantedPersons'
import { getStatusInfo } from '../utils/helpers'

// Nigerian state approximate centroids for the map pins
const STATE_COORDS = {
  'Lagos':       { x: 12, y: 74 },
  'Ogun':        { x: 17, y: 68 },
  'Oyo':         { x: 22, y: 60 },
  'Osun':        { x: 25, y: 63 },
  'Ondo':        { x: 27, y: 70 },
  'Ekiti':       { x: 28, y: 60 },
  'Edo':         { x: 34, y: 68 },
  'Delta':       { x: 30, y: 74 },
  'Anambra':     { x: 38, y: 68 },
  'Imo':         { x: 40, y: 73 },
  'Abia':        { x: 43, y: 70 },
  'Rivers':      { x: 38, y: 80 },
  'Bayelsa':     { x: 32, y: 80 },
  'Cross River': { x: 47, y: 72 },
  'Akwa Ibom':   { x: 44, y: 78 },
  'Enugu':       { x: 42, y: 62 },
  'Ebonyi':      { x: 46, y: 64 },
  'Kogi':        { x: 36, y: 55 },
  'Benue':       { x: 45, y: 52 },
  'Plateau':     { x: 46, y: 44 },
  'Abuja FCT':   { x: 38, y: 48 },
  'Niger':       { x: 30, y: 44 },
  'Kwara':       { x: 26, y: 52 },
  'Nassarawa':   { x: 42, y: 48 },
  'Taraba':      { x: 56, y: 45 },
  'Adamawa':     { x: 58, y: 35 },
  'Gombe':       { x: 54, y: 32 },
  'Borno':       { x: 62, y: 22 },
  'Yobe':        { x: 58, y: 18 },
  'Bauchi':      { x: 52, y: 36 },
  'Jigawa':      { x: 46, y: 24 },
  'Kano':        { x: 42, y: 28 },
  'Kaduna':      { x: 38, y: 34 },
  'Zamfara':     { x: 28, y: 28 },
  'Kebbi':       { x: 20, y: 28 },
  'Sokoto':      { x: 18, y: 20 },
  'Katsina':     { x: 34, y: 22 },
}

export default function MapPage() {
  const { persons, loading } = useWantedPersons()

  const withLocations = persons.filter(p => p.state && STATE_COORDS[p.state])

  return (
    <div className="page-enter" style={{ maxWidth: 1400, margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.2em', marginBottom: 6 }}>GEOGRAPHIC VIEW</div>
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(28px,4vw,52px)', letterSpacing: '0.05em' }}>
            LAST SEEN <span style={{ color: 'var(--accent)' }}>MAP</span>
          </h1>
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)' }}>
          {withLocations.length} records with known locations · Integrate Google Maps API for full functionality
        </div>
      </div>

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 2,
        padding: '1.5rem', marginBottom: '1.5rem',
      }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--gold)', marginBottom: 12, letterSpacing: '0.1em' }}>
          ⚠ SCHEMATIC MAP — Integrate Google Maps API key in .env as VITE_GOOGLE_MAPS_KEY for the full interactive map
        </div>

        {/* Schematic Nigeria map */}
        <div style={{
          position: 'relative', width: '100%', paddingBottom: '60%',
          background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden',
          border: '1px solid var(--border)',
        }}>
          {/* Grid lines */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3 }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <line key={`v${i}`} x1={`${i * 11}%`} y1="0" x2={`${i * 11}%`} y2="100%"
                stroke="var(--border2)" strokeWidth="1" />
            ))}
            {Array.from({ length: 8 }).map((_, i) => (
              <line key={`h${i}`} x1="0" y1={`${i * 14}%`} x2="100%" y2={`${i * 14}%`}
                stroke="var(--border2)" strokeWidth="1" />
            ))}
          </svg>

          {/* Schematic Nigeria outline label */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            fontFamily: 'var(--display)', fontSize: 'clamp(20px,4vw,56px)',
            color: 'rgba(255,255,255,0.03)', letterSpacing: '0.2em', userSelect: 'none',
          }}>NIGERIA</div>

          {/* Pins */}
          {withLocations.map(person => {
            const coords = STATE_COORDS[person.state]
            if (!coords) return null
            const status = getStatusInfo(person.status)
            const pinColor = person.status === 'Wanted' ? 'var(--accent)'
              : person.status === 'Escaped' ? 'var(--purple)'
              : person.status === 'Apprehended' ? 'var(--green)'
              : 'var(--gold)'

            return (
              <div key={person.id} style={{
                position: 'absolute',
                left: `${coords.x}%`, top: `${coords.y}%`,
                transform: 'translate(-50%,-50%)',
              }}
                title={`${person.name} · ${person.state}`}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: pinColor, cursor: 'pointer',
                  boxShadow: `0 0 0 3px ${pinColor}40`,
                  animation: person.status === 'Wanted' ? 'pulse-dot 2s ease-in-out infinite' : 'none',
                }} />
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { color: 'var(--accent)',  label: 'Wanted' },
            { color: 'var(--purple)', label: 'Escaped' },
            { color: 'var(--green)',  label: 'Apprehended' },
            { color: 'var(--gold)',   label: 'Convicted' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text2)', letterSpacing: '0.1em' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Google Maps integration notice */}
      <div style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 2 }}>
        <div style={{ fontFamily: 'var(--display)', fontSize: 20, letterSpacing: '0.05em', marginBottom: 8 }}>
          GOOGLE MAPS INTEGRATION
        </div>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 12 }}>
          To enable the full interactive map with precise last-seen coordinates, clustering, and directions:
        </p>
        <ol style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text2)', lineHeight: 1.8, paddingLeft: '1.2rem' }}>
          <li>Create a project in Google Cloud Console</li>
          <li>Enable Maps JavaScript API and Geocoding API</li>
          <li>Add <code style={{ color: 'var(--accent)' }}>VITE_GOOGLE_MAPS_KEY=your_key</code> to your <code>.env</code> file</li>
          <li>Install <code style={{ color: 'var(--accent)' }}>@react-google-maps/api</code></li>
          <li>Replace the schematic above with the <code>&lt;GoogleMap /&gt;</code> component</li>
        </ol>
      </div>
    </div>
  )
}
