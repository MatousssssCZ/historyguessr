import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { currentLocale } from '@/i18n'

export default function TermsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-200)' }}>

      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '16px 24px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
      }}>
        <button
          onClick={() => navigate(-1)}
          className="btn btn-ghost"
          style={{ padding: '7px 12px', fontSize: 13 }}
        >
          ← {t('legal.back')}
        </button>
        <div>
          <div className="eyebrow" style={{ fontSize: 9 }}>HistoryGuessr</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, margin: 0, letterSpacing: '-0.01em' }}>
            {t('legal.terms.title')}
          </h1>
        </div>
      </header>

      {/* Obsah */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px' }}>

        <div className="card" style={{ padding: '24px 32px', marginBottom: 20 }}>
          <div style={{
            background: 'rgba(217,119,87,0.08)',
            border: '1px solid rgba(217,119,87,0.2)',
            borderRadius: 8, padding: '12px 16px', marginBottom: 28,
          }}>
            <p style={{ fontSize: 13, color: 'var(--accent-deep)', margin: 0 }}>
              {t('legal.placeholder')}
            </p>
          </div>

          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 32 }}>
            {t('legal.lastUpdated')}: {new Date().toLocaleDateString(currentLocale())}
          </p>

          <Section title={t('legal.terms.s1t')}>
            <p>{t('legal.terms.s1b')}</p>
          </Section>

          <Section title={t('legal.terms.s2t')}>
            <p>{t('legal.terms.s2b')}</p>
          </Section>

          <Section title={t('legal.terms.s3t')}>
            <ul>
              <li>{t('legal.terms.s3i1')}</li>
              <li>{t('legal.terms.s3i2')}</li>
              <li>{t('legal.terms.s3i3')}</li>
              <li>{t('legal.terms.s3i4')}</li>
            </ul>
          </Section>

          <Section title={t('legal.terms.s4t')}>
            <p>{t('legal.terms.s4intro')}</p>
            <ul>
              <li>{t('legal.terms.s4i1')}</li>
              <li>{t('legal.terms.s4i2')}</li>
              <li>{t('legal.terms.s4i3')}</li>
              <li>{t('legal.terms.s4i4')}</li>
            </ul>
          </Section>

          <Section title={t('legal.terms.s5t')}>
            <p>{t('legal.terms.s5b')}</p>
          </Section>

          <Section title={t('legal.terms.s6t')}>
            <p>{t('legal.terms.s6b')}</p>
          </Section>

          <Section title={t('legal.terms.s7t')}>
            <p>{t('legal.terms.s7b')}</p>
          </Section>

          <Section title={t('legal.terms.s8t')}>
            <p>{t('legal.terms.s8b')}</p>
          </Section>

          <Section title={t('legal.terms.s9t')} last>
            <p>{t('legal.terms.s9b1')}<strong>[email]</strong></p>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : 28, paddingBottom: last ? 0 : 28, borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, margin: '0 0 12px', letterSpacing: '-0.01em' }}>{title}</h2>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  )
}
