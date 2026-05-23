import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Home from './pages/Home'
import Agencies from './pages/Agencies'
import MapPage from './pages/Map'
import SubmitTip from './pages/SubmitTip'
import './styles/global.css'

export default function App() {
  return (
    <BrowserRouter>
      <Header alertCount={3} />
      <Routes>
        <Route path="/"          element={<Home />} />
        <Route path="/agencies"  element={<Agencies />} />
        <Route path="/map"       element={<MapPage />} />
        <Route path="/submit"    element={<SubmitTip />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  )
}

function Footer() {
  return (
    <footer style={{ marginTop: '4rem', borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '2rem' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <div style={{ flex: '0 0 220px' }}>
            <div style={{ fontFamily: 'var(--display)', fontSize: 22, letterSpacing: '0.1em', marginBottom: 8 }}>NGA-WATCH</div>
            <p style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', lineHeight: 1.6 }}>
              Unified Nigerian criminal wanted catalogue. Aggregating publicly published records from federal law enforcement agencies.
            </p>
          </div>
          {[
            { title: 'Platform', links: ['Database', 'Map View', 'Agencies', 'Submit Tip'] },
            { title: 'Agencies', links: ['EFCC', 'Nigeria Police Force', 'ICPC', 'Ministry of Interior'] },
            { title: 'Emergency', links: ['Emergency: 112', 'EFCC: 0800-883-2679', 'Police: 199', 'NPF: 08033940940'] },
          ].map(col => (
            <div key={col.title} style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.2em', marginBottom: 10 }}>
                {col.title}
              </div>
              {col.links.map(l => (
                <div key={l} style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 5, lineHeight: 1.4 }}>
                  {l}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)' }}>
            © 2025 NGA-WATCH — Data sourced from public government websites · FOI Act 2011
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--gold)' }}>
            ⚠ Misuse is an offence under the Cybercrimes Act 2015
          </span>
        </div>
      </div>
    </footer>
  )
}
