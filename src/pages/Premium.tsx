import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getMyEntitlements, track } from '@/lib/supabase'
import { isPremiumUser, type Entitlements } from '@/lib/entitlements'
import { PREMIUM_PRICE, PREMIUM_BENEFITS } from '@/lib/premium'
import { PageHeader } from '@/components/ui/Page'
import { currentLocale } from '@/i18n'

export default function PremiumPage() {
  const { t } = useTranslation()
  const { user, isAnonymous } = useAuth()
  const navigate = useNavigate()
  const [ent, setEnt] = useState<Entitlements | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutNote, setCheckoutNote] = useState(false)

  useEffect(() => {
    getMyEntitlements().then(setEnt).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const premium = isPremiumUser(ent)

  function handleCheckout() {
    // Platební brána zatím není napojená — zobraz upozornění a zaznamenej záměr.
    track('premium_checkout_clicked', { price: PREMIUM_PRICE.amount }, user?.id)
    setCheckoutNote(true)
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-200)', paddingTop: 'var(--safe-top)' }}>
      {/* Header */}
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 18px 60px' }}>
        <PageHeader title="Premium" onBack={() => navigate(-1)}/>

        {/* Hero */}
        <div style={{
          borderRadius: 22, overflow: 'hidden', marginBottom: 16,
          background: 'linear-gradient(150deg,#d97757,#b85a3e)', color: '#fff',
          padding: '26px 22px', position: 'relative',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', opacity: 0.9 }}>
            {t('premium.eyebrow')}
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 27, lineHeight: 1.15, margin: '8px 0 6px' }}>
            {premium ? t('premium.activeTitle') : t('premium.heroTitle')}
          </div>
          <div style={{ fontSize: 14, opacity: 0.92, lineHeight: 1.5 }}>
            {premium ? t('premium.activeSub') : t('premium.heroSub')}
          </div>
          {premium && ent?.premiumUntil && (
            <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 12, background: 'rgba(255,255,255,0.18)', display: 'inline-block', padding: '5px 11px', borderRadius: 20 }}>
              {t('premium.until', { date: new Date(ent.premiumUntil).toLocaleDateString(currentLocale()) })}
            </div>
          )}
        </div>

        {/* Výhody */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '18px 20px', marginBottom: 16 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 14px' }}>
            {t('premium.whatYouGet')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {PREMIUM_BENEFITS.map(b => (
              <div key={b.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 20, lineHeight: 1.2, flexShrink: 0, width: 26, textAlign: 'center' }}>{b.icon}</span>
                <div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{t('premium.benefit.' + b.key + '.t')}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 1, lineHeight: 1.4 }}>{t('premium.benefit.' + b.key + '.d')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA / stav */}
        {loading ? null : premium ? (
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-3)' }}>{t('premium.thanksActive')}</div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 18, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 34, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{PREMIUM_PRICE.amount} {PREMIUM_PRICE.currency}</span>
              <span style={{ fontSize: 14, color: 'var(--ink-3)' }}>/ {t('premium.perMonth')}</span>
            </div>
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>{t('premium.cancelAnytime')}</div>
            {isAnonymous ? (
              <>
                <button onClick={() => navigate('/auth', { state: { mode: 'register' } })} style={{
                  width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 13,
                  padding: 15, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                }}>{t('premium.guestCta')} →</button>
                <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  {t('premium.guestNote')}
                </div>
              </>
            ) : (
              <>
                <button onClick={handleCheckout} style={{
                  width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 13,
                  padding: 15, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                }}>{t('premium.cta')}</button>
                {checkoutNote && (
                  <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12.5, color: 'var(--accent-deep)', background: 'rgba(217,119,87,0.08)', border: '1px solid rgba(217,119,87,0.2)', borderRadius: 10, padding: '10px 12px' }}>
                    {t('premium.comingSoon')}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
