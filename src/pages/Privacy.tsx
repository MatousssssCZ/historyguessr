import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { currentLocale } from '@/i18n'
import BackButton from '@/components/BackButton'

export default function PrivacyPage() {
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
        <BackButton onClick={() => navigate(-1)} label={t('legal.back')} />
        <div>
          <div className="eyebrow" style={{ fontSize: 9 }}>HistoryGuessr</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, margin: 0, letterSpacing: '-0.01em' }}>
            {t('legal.privacy.title')}
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

          <Section title={t('legal.privacy.s1t')}>
            <p>{t('legal.privacy.s1b')}</p>
          </Section>

          <Section title={t('legal.privacy.s2t')}>
            <p>{t('legal.privacy.s2intro')}</p>
            <ul>
              <li><strong>{t('legal.privacy.s2i1')}</strong>{t('legal.privacy.s2i1d')}</li>
              <li><strong>{t('legal.privacy.s2i2')}</strong>{t('legal.privacy.s2i2d')}</li>
              <li><strong>{t('legal.privacy.s2i3')}</strong>{t('legal.privacy.s2i3d')}</li>
              <li><strong>{t('legal.privacy.s2i4')}</strong>{t('legal.privacy.s2i4d')}</li>
            </ul>
          </Section>

          <Section title={t('legal.privacy.s3t')}>
            <ul>
              <li>{t('legal.privacy.s3i1')}</li>
              <li>{t('legal.privacy.s3i2')}</li>
              <li>{t('legal.privacy.s3i3')}</li>
              <li>{t('legal.privacy.s3i4')}</li>
            </ul>
          </Section>

          <Section title={t('legal.privacy.s4t')}>
            <p>{t('legal.privacy.s4b')}</p>
          </Section>

          <Section title={t('legal.privacy.s5t')}>
            <p>{t('legal.privacy.s5b')}</p>
          </Section>

          <Section title={t('legal.privacy.s6t')}>
            <p>{t('legal.privacy.s6b')}</p>
          </Section>

          <Section title={t('legal.privacy.s7t')}>
            <p>{t('legal.privacy.s7b')}</p>
          </Section>

          <Section title={t('legal.privacy.s8t')} last>
            <p>{t('legal.privacy.s8b1')}<strong>[email]</strong></p>
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
