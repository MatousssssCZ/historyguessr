import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { submitFeedback, type FeedbackKind } from '@/lib/feedback'

const KINDS: FeedbackKind[] = ['bug', 'idea', 'other']

// Sdílený modál pro hlášení chyby / zpětnou vazbu. `defaultKind` a `context`
// (např. text chyby z ErrorBoundary) jsou nepovinné.
export default function FeedbackModal({ onClose, defaultKind = 'bug', context }: {
  onClose: () => void; defaultKind?: FeedbackKind; context?: string
}) {
  const { t } = useTranslation()
  const [kind, setKind] = useState<FeedbackKind>(defaultKind)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function send() {
    if (!msg.trim() || busy) return
    setBusy(true)
    const body = context ? `${msg.trim()}\n\n---\n${context}` : msg.trim()
    try { await submitFeedback(kind, body); setDone(true) }
    catch { /* best-effort */ setDone(true) }
    finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(13,9,6,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, maxWidth: 440, width: '100%', boxShadow: 'var(--shadow-lg)', padding: 22 }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: 34 }}>🙏</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: '10px 0 6px' }}>{t('feedback.thanksTitle')}</div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '0 0 18px', lineHeight: 1.5 }}>{t('feedback.thanksBody')}</p>
            <button onClick={onClose} className="btn btn-accent" style={{ width: '100%' }}>{t('common.close')}</button>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 21, marginBottom: 4 }}>{t('feedback.title')}</div>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '0 0 16px', lineHeight: 1.5 }}>{t('feedback.sub')}</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {KINDS.map(k => (
                <button key={k} onClick={() => setKind(k)} style={{
                  flex: 1, padding: '9px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12.5,
                  border: `1.5px solid ${kind === k ? 'var(--accent)' : 'var(--line)'}`,
                  background: kind === k ? 'rgba(217,119,87,0.10)' : 'transparent',
                  color: kind === k ? 'var(--accent-deep)' : 'var(--ink-2)',
                }}>{t('feedback.kind.' + k)}</button>
              ))}
            </div>
            <textarea value={msg} onChange={e => setMsg(e.target.value)} maxLength={2000} rows={5} placeholder={t('feedback.placeholder')} style={{
              width: '100%', boxSizing: 'border-box', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 11,
              padding: '11px 13px', fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--ink)', marginBottom: 14, resize: 'vertical',
            }}/>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, background: 'var(--paper-200)', border: '1px solid var(--line)', borderRadius: 11, padding: 12, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}>{t('common.close')}</button>
              <button onClick={send} disabled={!msg.trim() || busy} style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 11, padding: 12, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#fff', cursor: 'pointer', opacity: !msg.trim() || busy ? 0.6 : 1 }}>{t('feedback.send')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
