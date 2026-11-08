import { useTranslation } from 'react-i18next'
import { track } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

// Odkaz na donační službu (Ko-fi / Buy Me a Coffee / Stripe Payment Link).
// Nastav na Vercelu: VITE_COFFEE_URL=https://ko-fi.com/historyguesser (apod.)
// Dokud není nastaveno, karta se nezobrazí (nic rozbitého v produkci).
const COFFEE_URL = import.meta.env.VITE_COFFEE_URL as string | undefined

function CoffeeIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/>
      <path d="M17 10h2.2a2.3 2.3 0 0 1 0 4.6H17"/>
      <path d="M7.5 2.5c-.6.8-.6 1.7 0 2.5M11 2.5c-.6.8-.6 1.7 0 2.5"/>
    </svg>
  )
}

/** Nenásilná výzva k dobrovolnému příspěvku („pozvi nás na kávu"). */
export default function SupportCoffee() {
  const { t } = useTranslation()
  const { user } = useAuth()
  if (!COFFEE_URL) return null

  const onClick = () => { try { track('coffee_clicked', {}, user?.id) } catch { /* ignore */ } }

  return (
    <div style={{ background: 'linear-gradient(150deg, rgba(217,119,87,.14), rgba(217,119,87,.05))', border: '1px solid rgba(217,119,87,.34)', borderRadius: 18, padding: 16, marginBottom: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 12, background: 'var(--accent, #d97757)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CoffeeIcon size={21}/></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)' }}>{t('support.title')}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>{t('support.sub')}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, margin: '2px 0 13px' }}>
        {['support.b1', 'support.b2', 'support.b3'].map(k => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink-2)' }}>
            <span style={{ color: 'var(--accent, #d97757)', flexShrink: 0 }}>✓</span>{t(k)}
          </div>
        ))}
      </div>

      <a href={COFFEE_URL} target="_blank" rel="noopener noreferrer" onClick={onClick} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', boxSizing: 'border-box',
        padding: 13, borderRadius: 13, textDecoration: 'none',
        background: 'var(--accent, #d97757)', color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14.5,
        boxShadow: '0 14px 30px -18px rgba(217,119,87,.9)',
      }}>
        <CoffeeIcon size={18}/> {t('support.cta')}
      </a>
    </div>
  )
}
