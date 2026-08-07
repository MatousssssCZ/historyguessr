import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { Link } from 'react-router-dom'

// Veřejná landing pro nepřihlášené — jediná bohatá, indexovatelná stránka
// (SEO / AI discoverability). Nepotřebuje přihlášení. CTA vedou do hry.
export default function LandingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const steps = [
    { icon: '🖼', t: t('menu.ht1t'), d: t('menu.ht1d') },
    { icon: '📍', t: t('menu.ht2t'), d: t('menu.ht2d') },
    { icon: '📅', t: t('menu.ht3t'), d: t('menu.ht3d') },
  ]
  const faq = [1, 2, 3, 4, 5].map(n => ({ q: t('landing.faqQ' + n), a: t('landing.faqA' + n) }))

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-50)', color: 'var(--ink)' }}>
      {/* Top bar */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 960, margin: '0 auto', padding: '16px 20px' }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, letterSpacing: '-0.01em' }}>Historyguesser</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LanguageSwitcher/>
          <button onClick={() => navigate('/auth')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--ink-2)' }}>{t('landing.login')}</button>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 24px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--accent-deep)', marginBottom: 16 }}>{t('landing.eyebrow')}</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 42, lineHeight: 1.1, margin: '0 0 16px', letterSpacing: '-0.02em' }}>{t('landing.h1')}</h1>
        <p style={{ fontSize: 17, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 auto 28px', maxWidth: 560 }}>{t('landing.sub')}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/auth', { state: { mode: 'register' } })} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 13, padding: '14px 26px', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>{t('landing.ctaPlay')} →</button>
          <button onClick={() => navigate('/try')} style={{ background: 'transparent', color: 'var(--ink)', border: '1.5px solid var(--line-strong)', borderRadius: 13, padding: '14px 26px', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>{t('landing.ctaTry')}</button>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 12 }}>{t('landing.freeNote')}</div>
      </section>

      {/* Náhledový obrázek */}
      <section style={{ maxWidth: 820, margin: '0 auto', padding: '8px 20px 20px' }}>
        <img src="/og.png" alt={t('landing.h1')} loading="lazy" style={{ width: '100%', height: 'auto', borderRadius: 18, border: '1px solid var(--line)' }}/>
      </section>

      {/* Jak se to hraje */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 27, textAlign: 'center', margin: '0 0 24px' }}>{t('landing.howTitle')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '20px 18px' }}>
              <div style={{ fontSize: 28 }}>{s.icon}</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, margin: '12px 0 5px' }}>{i + 1}. {s.t}</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Herní režimy */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '12px 20px 32px' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 27, textAlign: 'center', margin: '0 0 24px' }}>{t('landing.modesTitle')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {['solo', 'daily', 'campaigns', 'mp'].map(m => (
            <div key={m} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px 16px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14.5 }}>{t('landing.mode_' + m + '_t')}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.5 }}>{t('landing.mode_' + m + '_d')}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '12px 20px 40px' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 27, textAlign: 'center', margin: '0 0 24px' }}>{t('landing.faqTitle')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {faq.map((f, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px 18px' }}>
              <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, margin: '0 0 6px' }}>{f.q}</h3>
              <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA + footer */}
      <section style={{ textAlign: 'center', padding: '20px 20px 12px' }}>
        <button onClick={() => navigate('/auth', { state: { mode: 'register' } })} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 13, padding: '14px 30px', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>{t('landing.ctaPlay')} →</button>
      </section>
      <footer style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 40px', textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.7 }}>
        <div>{t('landing.footer')}</div>
        <div style={{ marginTop: 8 }}>
          <Link to="/terms" style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}>{t('auth.terms')}</Link>
          {' · '}
          <Link to="/privacy" style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}>{t('auth.privacy')}</Link>
        </div>
      </footer>
    </div>
  )
}
