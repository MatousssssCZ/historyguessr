import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { currentLocale } from '@/i18n'
import BackButton from '@/components/BackButton'
import LegalDocView from '@/components/LegalDocView'
import { useNoindex } from '@/lib/useNoindex'
import { PRIVACY, type LegalLocale } from './legalContent'

export default function PrivacyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  useNoindex()
  const lng = (currentLocale().slice(0, 2) as LegalLocale)
  const doc = PRIVACY[lng] ?? PRIVACY.cs

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-200)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <BackButton onClick={() => navigate(-1)} label={t('legal.back')} />
        <div>
          <div className="eyebrow" style={{ fontSize: 9 }}>Historyguesser</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, margin: 0, letterSpacing: '-0.01em' }}>{doc.title}</h1>
        </div>
      </header>
      <LegalDocView doc={doc} />
    </div>
  )
}
