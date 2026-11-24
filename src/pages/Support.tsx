import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PageShell, PageHeader } from '@/components/ui/Page'
import MobileNav from '@/components/MobileNav'
import { track } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

// Výchozí Ko-fi; přepsatelné přes VITE_COFFEE_URL na Vercelu (bez redeploy stránky).
const COFFEE_URL = (import.meta.env.VITE_COFFEE_URL as string | undefined) || 'https://ko-fi.com/matousbahnik'
const ACCENT = '#d97757'

function Cup({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h2.2a2.3 2.3 0 0 1 0 4.6H17"/>
      <path d="M7.5 2.5c-.6.8-.6 1.7 0 2.5M11 2.5c-.6.8-.6 1.7 0 2.5"/>
    </svg>
  )
}

export default function SupportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const onCta = () => { try { track('coffee_clicked', { from: 'support_page' }, user?.id) } catch { /* ignore */ } }

  const milestones = [1, 2, 3, 4].map(i => ({ cups: i, title: t(`support.m${i}title`), desc: t(`support.m${i}desc`) }))

  const CtaButton = ({ small }: { small?: boolean }) => (
    COFFEE_URL ? (
      <a href={COFFEE_URL} target="_blank" rel="noopener noreferrer" onClick={onCta} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', boxSizing: 'border-box',
        padding: small ? 12 : 15, borderRadius: 14, textDecoration: 'none',
        background: 'linear-gradient(150deg,#F2C14E,#E0A32E)', color: '#2a1f17', fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: small ? 14 : 15.5,
        boxShadow: '0 16px 34px -18px rgba(240,190,70,.85)',
      }}><Cup size={small ? 17 : 19}/> {t('support.cta')}</a>
    ) : (
      <div style={{ padding: 13, borderRadius: 14, background: 'var(--paper-200)', border: '1px dashed var(--line-strong)', color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>{t('support.soon')}</div>
    )
  )

  return (
    <PageShell maxWidth={640}>
      <PageHeader eyebrow={t('support.eyebrow')} title={t('support.title')} onBack={() => navigate(-1)}/>

      {/* Lead */}
      <div style={{ background: 'linear-gradient(150deg, rgba(217,119,87,.14), rgba(217,119,87,.05))', border: '1px solid rgba(217,119,87,.34)', borderRadius: 20, padding: '20px 18px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 12 }}>
          <span style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 14, background: ACCENT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Cup size={25}/></span>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{t('support.leadTitle')}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>{t('support.leadSub')}</div>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>{t('support.lead')}</p>
      </div>

      {/* Ko-fi widget — přispět přímo tady, bez odchodu z appky */}
      <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid var(--line)', background: '#f9f9f9', marginBottom: 10 }}>
        <iframe
          title="Ko-fi matousbahnik"
          src="https://ko-fi.com/matousbahnik/?hidefeed=true&widget=true&embed=true&preview=true"
          style={{ border: 'none', width: '100%', height: 712, display: 'block', background: '#f9f9f9' }}
        />
      </div>
      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-3)', margin: '0 0 14px' }}>
        {COFFEE_URL && <a href={COFFEE_URL} target="_blank" rel="noopener noreferrer" onClick={onCta} style={{ color: 'var(--accent, #d97757)', textDecoration: 'none' }}>{t('support.openKofi')} →</a>}
      </p>

      {/* Proč podpořit */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 16, marginBottom: 14 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 10px' }}>{t('support.whyTitle')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['support.b1', 'support.b2', 'support.b3'].map(k => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: 'var(--ink-2)' }}>
              <span style={{ color: ACCENT, flexShrink: 0 }}>✓</span>{t(k)}
            </div>
          ))}
        </div>
      </div>

      {/* Milníky */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 16, marginBottom: 14 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 4px' }}>{t('support.goalsTitle')}</p>
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: '0 0 14px' }}>{t('support.goalsSub')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {milestones.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingTop: i === 0 ? 0 : 10, borderTop: i === 0 ? 0 : '1px solid var(--line)' }}>
              <span style={{ flexShrink: 0, whiteSpace: 'nowrap', letterSpacing: -2 }} aria-hidden="true">{'☕'.repeat(m.cups)}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>{m.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 1 }}>{m.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}><CtaButton/></div>
      <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 20 }}>{t('support.thanks')}</p>

      <MobileNav active="profile"/>
    </PageShell>
  )
}
