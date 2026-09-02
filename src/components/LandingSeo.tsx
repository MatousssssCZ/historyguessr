import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import i18n from '@/i18n'
import { exploreListPath, categoryPath, CATEGORIES, type ExploreLocale, type CategoryKey } from '@/lib/exploreUrls'

// Lehký, indexovatelný obsah (SEO / AI discoverability): nadpis, jak hrát, FAQ,
// odkazy do veřejné Explore vrstvy. Používá se pod menu-hero (homepage `/`,
// host-first) a historicky i pod přihlašovací stránkou. Vizuálně tlumené,
// světlá čtenářská sekce pod tmavým herem.
export default function LandingSeo() {
  const { t } = useTranslation()
  const steps = [
    { icon: '🖼', t: t('menu.ht1t'), d: t('menu.ht1d') },
    { icon: '📍', t: t('menu.ht2t'), d: t('menu.ht2d') },
    { icon: '📅', t: t('menu.ht3t'), d: t('menu.ht3d') },
  ]
  const faq = [1, 2, 3, 4, 5, 6, 7].map(n => ({ q: t('landing.faqQ' + n), a: t('landing.faqA' + n) }))
  const lng = (i18n.language || 'cs').slice(0, 2)
  const eloc: ExploreLocale = lng === 'en' ? 'en' : lng === 'de' ? 'de' : 'cs'
  const catKeys = Object.keys(CATEGORIES) as CategoryKey[]
  return (
    <div style={{ background: 'var(--paper-50)', color: 'var(--ink)', borderTop: '1px solid var(--line)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 22px 20px' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, textAlign: 'center', margin: '0 0 16px', letterSpacing: '-0.015em' }}>{t('landing.h1')}</h2>
        <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.65, textAlign: 'center', margin: '0 auto 28px', maxWidth: 620 }}>
          {t('landing.sub')}
        </p>

        {/* Prominentní vstup do veřejné Explore vrstvy (crawl + AdSense obsah). */}
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <a href={exploreListPath(eloc)} style={{ display: 'inline-block', padding: '13px 26px', borderRadius: 13, background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
            {t('menu.exploreHistory')} →
          </a>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 18 }}>
            {catKeys.map(k => (
              <a key={k} href={categoryPath(eloc, k)} style={{ padding: '7px 14px', borderRadius: 999, border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink-2)', fontSize: 13, textDecoration: 'none' }}>
                {CATEGORIES[k][eloc].label}
              </a>
            ))}
          </div>
        </div>

        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, textAlign: 'center', margin: '0 0 20px', letterSpacing: '-0.01em' }}>{t('landing.howTitle')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 44 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '18px 16px' }}>
              <div style={{ fontSize: 24 }}>{s.icon}</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14.5, margin: '10px 0 4px' }}>{i + 1}. {s.t}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>{s.d}</div>
            </div>
          ))}
        </div>

        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, textAlign: 'center', margin: '0 0 20px', letterSpacing: '-0.01em' }}>{t('landing.faqTitle')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {faq.map((f, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px' }}>
              <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14.5, margin: '0 0 5px' }}>{f.q}</h3>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </div>
      <footer style={{ maxWidth: 720, margin: '0 auto', padding: '32px 22px 48px', textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.7 }}>
        <div>{t('landing.footer')}</div>
        <div style={{ marginTop: 6 }}>
          {t('landing.contact')}:{' '}
          <a href="mailto:historyguesser.net@gmail.com" style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}>historyguesser.net@gmail.com</a>
        </div>
        <div style={{ marginTop: 8 }}>
          <Link to="/terms" style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}>{t('auth.termsLink')}</Link>
          {' · '}
          <Link to="/privacy" style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}>{t('auth.privacyLink')}</Link>
        </div>
      </footer>
    </div>
  )
}
