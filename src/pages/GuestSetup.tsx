import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { playAsGuest, assignGuestUsername, track } from '@/lib/supabase'
import { CAPTCHA_ENABLED } from '@/lib/turnstile'
import Turnstile from '@/components/Turnstile'
import HowToPlay from '@/components/HowToPlay'

// Vstup bez registrace. Host si NEvolí přezdívku — účet se vytvoří automaticky
// a dostane jméno „Host" + náhodné číslice. CAPTCHA běží neviditelně
// (interaction-only). Po vytvoření → „Jak hrát" → menu.
export default function GuestSetupPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, loading } = useAuth()

  // Kam pokračovat po vytvoření hosta. Přišel-li z herní akce (?next=/play),
  // přeskočíme intro a jdeme rovnou do hry. Sanitizace: jen interní cesta.
  const nextRaw = params.get('next') || ''
  const next = /^\/(?!\/)/.test(nextRaw) ? nextRaw : ''
  const dest = next || '/menu'

  // Zachytí, zda byl uživatel přihlášený už při příchodu (pak sem nepatří →
  // menu). Přihlášení během vytváření hosta redirect nespustí.
  const wasLoggedIn = useRef<boolean | null>(null)
  useEffect(() => {
    if (loading) return
    if (wasLoggedIn.current === null) wasLoggedIn.current = !!user
    if (wasLoggedIn.current) navigate(dest, { replace: true })
  }, [loading, user, navigate, dest])

  const [captcha, setCaptcha] = useState<string | null>(CAPTCHA_ENABLED ? null : '')
  const [captchaKey, setCaptchaKey] = useState(0)
  const [phase, setPhase] = useState<'creating' | 'choice' | 'howto' | 'error'>('creating')
  const [errMsg, setErrMsg] = useState('')
  const started = useRef(false)

  // Jakmile je captcha token (nebo captcha vypnutá), vytvoř host účet.
  useEffect(() => {
    if (started.current || captcha === null || wasLoggedIn.current) return
    started.current = true
    ;(async () => {
      const res = await playAsGuest(captcha || undefined)
      if (res.error || !res.userId) { setErrMsg(t('auth.errGeneric')); setPhase('error'); return }
      const { error } = await assignGuestUsername(res.userId)
      if (error) { setErrMsg(t('setup.error')); setPhase('error'); return }
      track('sign_up', { converted: false, guest: true }, res.userId)
      // Přišel z herní akce → rovnou do hry (bez intra). Jinak nabídni volbu.
      if (next) window.location.assign(next)
      else setPhase('choice')
    })()
  }, [captcha, t, next])

  function retry() {
    started.current = false
    setErrMsg(''); setPhase('creating')
    setCaptcha(CAPTCHA_ENABLED ? null : ''); setCaptchaKey(k => k + 1)
  }

  // Po vytvoření hosta → volba: projít intro, nebo rovnou hrát.
  if (phase === 'howto') return <HowToPlay onClose={() => window.location.assign('/menu')} />
  if (phase === 'choice') return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-200)', padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>👋</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{t('setup.welcomeTitle')}</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: '0 0 22px', lineHeight: 1.5 }}>{t('setup.welcomeSub')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-accent" style={{ width: '100%', padding: '14px 0', fontSize: 15.5, borderRadius: 13 }} onClick={() => window.location.assign('/menu')}>{t('setup.playNow')} →</button>
          <button className="btn btn-ghost" style={{ width: '100%', padding: '13px 0', fontSize: 14.5, borderRadius: 13 }} onClick={() => setPhase('howto')}>{t('setup.showHow')}</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-200)', padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>👋</div>
        {phase === 'error' ? (
          <>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, margin: '0 0 8px', letterSpacing: '-0.01em' }}>{t('common.errorTitle')}</h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '0 0 18px', lineHeight: 1.5 }}>{errMsg}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => navigate('/', { replace: true })}>{t('common.back')}</button>
              <button className="btn btn-accent" onClick={retry}>{t('game.retry')}</button>
            </div>
          </>
        ) : (
          <>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{t('setup.creating')}</h1>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
              <span className="spinner" style={{ width: 22, height: 22 }}/>
            </div>
          </>
        )}
        {/* Neviditelná CAPTCHA — token pro anonymní sign-in. Bez klíče se přeskočí. */}
        <Turnstile key={captchaKey} onToken={setCaptcha} onError={() => { setErrMsg(t('auth.captchaFailed')); setPhase('error') }} appearance="interaction-only" theme="light" />
      </div>
    </div>
  )
}
