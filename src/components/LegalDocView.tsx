import React from 'react'
import { LEGAL_EMAIL, type LegalDoc } from '@/pages/legalContent'

// Vloží mailto odkaz, když text obsahuje kontaktní e-mail.
function withEmail(text: string): React.ReactNode {
  const i = text.indexOf(LEGAL_EMAIL)
  if (i === -1) return text
  return (
    <>
      {text.slice(0, i)}
      <a href={`mailto:${LEGAL_EMAIL}`} style={{ color: 'var(--accent-deep)', textDecoration: 'underline' }}>{LEGAL_EMAIL}</a>
      {text.slice(i + LEGAL_EMAIL.length)}
    </>
  )
}

export default function LegalDocView({ doc }: { doc: LegalDoc }) {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 80px' }}>
      <div className="card" style={{ padding: '28px 32px' }}>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '0 0 28px' }}>{doc.updated}</p>

        {doc.blocks.map((b, i) => {
          if (b.t === 'h') {
            return (
              <h2 key={i} style={{ fontFamily: 'var(--font-serif)', fontSize: 18, letterSpacing: '-0.01em', margin: '28px 0 10px', paddingTop: 4 }}>
                {b.text}
              </h2>
            )
          }
          if (b.t === 'ul') {
            return (
              <ul key={i} style={{ margin: '0 0 12px', paddingLeft: 22, color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.7 }}>
                {b.items.map((it, j) => <li key={j} style={{ marginBottom: 3 }}>{it}</li>)}
              </ul>
            )
          }
          if (b.t === 'box') {
            return (
              <div key={i} style={{ background: 'var(--paper-200)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', margin: '0 0 14px' }}>
                {b.lines.map((l, j) => (
                  <div key={j} style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65, fontWeight: j === 0 ? 600 : 400 }}>{withEmail(l)}</div>
                ))}
              </div>
            )
          }
          return (
            <p key={i} style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, margin: '0 0 12px' }}>{withEmail(b.text)}</p>
          )
        })}
      </div>
    </div>
  )
}
