import { useState } from 'react'
import { useBreakpoint } from '../hooks/useBreakpoint'

export default function SubmitTip() {
  const [form, setForm] = useState({ agency: '', name: '', location: '', description: '', contact: '' })
  const [submitted, setSubmitted] = useState(false)
  const { isMobile } = useBreakpoint()

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = () => {
    if (!form.description) return
    setSubmitted(true)
  }

  const pad = isMobile ? '0.875rem' : '1.25rem'

  if (submitted) return (
    <div className="page-enter" style={{ maxWidth: 600, margin: '3rem auto', padding: `2rem ${pad}`, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
      <div style={{ fontFamily: 'var(--display)', fontSize: isMobile ? 28 : 36, letterSpacing: '0.05em', color: 'var(--green)', marginBottom: 12 }}>
        TIP RECEIVED
      </div>
      <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)', lineHeight: 1.7 }}>
        Your anonymous report has been logged and will be forwarded to the relevant agency within 24 hours.
        Your identity is protected. Reference: <strong style={{ color: 'var(--text)' }}>TIP-{Date.now().toString(36).toUpperCase()}</strong>
      </p>
      <p style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginTop: 12 }}>
        In an emergency, always call <strong style={{ color: 'var(--text)' }}>112</strong>
      </p>
      <button className="btn btn-outline" style={{ marginTop: 24 }} onClick={() => setSubmitted(false)}>
        Submit Another Tip
      </button>
    </div>
  )

  return (
    <div className="page-enter" style={{ maxWidth: 760, margin: '0 auto', padding: `1.5rem ${pad}` }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.2em', marginBottom: 6 }}>
          ANONYMOUS TIP LINE
        </div>
        <h1 style={{ fontFamily: 'var(--display)', fontSize: 'clamp(26px,5vw,56px)', letterSpacing: '0.05em' }}>
          SUBMIT A <span style={{ color: 'var(--accent)' }}>TIP</span>
        </h1>
        <p style={{ fontFamily: 'var(--mono)', fontSize: isMobile ? 10 : 11, color: 'var(--text2)', marginTop: 8, lineHeight: 1.6, maxWidth: 560 }}>
          Your identity is fully anonymous. Tips are encrypted and forwarded directly to the relevant agency.
          You may optionally provide contact details to receive a case reference number.
        </p>
      </div>

      <div className="panel">
        <div className="panel-header"><span className="panel-title">Tip Information</span></div>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div>
            <label style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>
              RELATING TO AGENCY
            </label>
            <select className="input select" value={form.agency} onChange={e => update('agency', e.target.value)}>
              <option value="">Select Agency (optional)</option>
              <option value="efcc">EFCC — Financial Crime</option>
              <option value="npf">NPF — Nigeria Police Force</option>
              <option value="icpc">ICPC — Corruption</option>
              <option value="interior">Interior / Immigration</option>
            </select>
          </div>

          <div>
            <label style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>
              PERSON'S NAME (IF KNOWN)
            </label>
            <input className="input" placeholder="Full name or alias..." value={form.name} onChange={e => update('name', e.target.value)} />
          </div>

          <div>
            <label style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>
              LAST KNOWN LOCATION
            </label>
            <input className="input" placeholder="City, state, address or landmark..." value={form.location} onChange={e => update('location', e.target.value)} />
          </div>

          <div>
            <label style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>
              DESCRIPTION / INFORMATION <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <textarea
              className="input"
              style={{ minHeight: isMobile ? 100 : 120, resize: 'vertical', fontFamily: 'var(--mono)', lineHeight: 1.6 }}
              placeholder="Describe what you know. Be as specific as possible — physical description, vehicle, associates, patterns, etc."
              value={form.description}
              onChange={e => update('description', e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', letterSpacing: '0.15em', display: 'block', marginBottom: 6 }}>
              CONTACT (OPTIONAL — to receive case ref)
            </label>
            <input className="input" placeholder="Phone or email (optional, not required)" value={form.contact} onChange={e => update('contact', e.target.value)} />
          </div>

          <div style={{
            background: 'rgba(0,200,83,0.06)', border: '1px solid rgba(0,200,83,0.18)',
            padding: '10px 14px', borderRadius: 2,
            fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text2)', lineHeight: 1.6,
          }}>
            🔒 <strong style={{ color: 'var(--green)' }}>PRIVACY PROTECTED:</strong> Your tip is transmitted over TLS encryption.
            No IP address or device information is logged. The Whistleblower Protection Act 2011 applies.
          </div>

          <button
            className="btn btn-primary"
            style={{ justifyContent: 'center', padding: '13px' }}
            disabled={!form.description}
            onClick={handleSubmit}>
            📩 Submit Anonymous Tip
          </button>

          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)', textAlign: 'center' }}>
            For emergencies, call <strong style={{ color: 'var(--text)' }}>112</strong> immediately
          </div>
        </div>
      </div>
    </div>
  )
}
