import { useTranslation } from 'react-i18next'
import { LANGUAGES, setLanguage } from '@/i18n'

/** Přepínač jazyka CS / EN / DE.
 *  variant="dark"  → na feature ploše (tématické tokeny)
 *  variant="light" → na běžné (flipující) ploše */
export default function LanguageSwitcher({ variant = 'light' }: { variant?: 'dark' | 'light' }) {
  const { i18n } = useTranslation()
  const cur = (i18n.language || 'en').slice(0, 2)
  const onFeature = variant === 'dark'
  const idle = onFeature ? 'var(--feature-fg2)' : 'var(--ink-3)'
  const border = onFeature ? 'var(--feature-line)' : 'var(--line-strong)'

  return (
    <div style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${border}`, flexShrink: 0 }}>
      {LANGUAGES.map((l, i) => {
        const active = cur === l.code
        return (
          <button
            key={l.code}
            onClick={() => setLanguage(l.code)}
            aria-label={l.label}
            style={{
              padding: '5px 8px', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
              border: 'none', borderLeft: i === 0 ? 'none' : `1px solid ${border}`, cursor: 'pointer',
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? '#fff' : idle,
            }}
          >
            {l.short}
          </button>
        )
      })}
    </div>
  )
}
