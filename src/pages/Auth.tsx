import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { signIn, signUp, requestPasswordReset, track, convertGuestToAccount, clearUsername } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import Turnstile from '@/components/Turnstile'
import PanoramaBackdrop from '@/components/PanoramaBackdrop'
import { CAPTCHA_ENABLED } from '@/lib/turnstile'
import { exploreListPath, categoryPath, CATEGORIES, type ExploreLocale, type CategoryKey } from '@/lib/exploreUrls'
import i18n from '@/i18n'

const forgotLinkStyle: React.CSSProperties = {
  alignSelf: 'flex-end', background: 'none', border: 'none', padding: 0,
  marginTop: -6, color: 'var(--ink-3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
}

type Mode = 'login' | 'register'

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8,           key: 'auth.rule8' },
  { test: (p: string) => /[A-Z]/.test(p),         key: 'auth.ruleUpper' },
  { test: (p: string) => /[0-9]/.test(p),         key: 'auth.ruleNum' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p),  key: 'auth.ruleSpecial' },
]

export default function AuthPage({ landing = false }: { landing?: boolean } = {}) {
  const { t } = useTranslation()
  const { isAnonymous, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>((location.state as { mode?: Mode } | null)?.mode === 'register' ? 'register' : 'login')

  // Vstup bez registrace → samostatná obrazovka (přezdívka + viditelná captcha),
  // účet vzniká až tam. Sem se anonym nepřihlašuje.
  const startGuest = () => navigate('/guest')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  // Captcha token (Turnstile). '' = není potřeba (vypnuto), null = čeká na ověření.
  const [captcha, setCaptcha] = useState<string | null>(CAPTCHA_ENABLED ? null : '')
  const [captchaKey, setCaptchaKey] = useState(0)
  const [captchaFailed, setCaptchaFailed] = useState(false)
  const resetCaptcha = () => { if (CAPTCHA_ENABLED) { setCaptcha(null); setCaptchaKey(k => k + 1) } }

  const passwordValid = PASSWORD_RULES.every(r => r.test(password))
  const isRegister = mode === 'register'
  const [windowWidth, setWindowWidth] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  React.useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSuccess(null)
    if (isRegister) {
      if (!passwordValid) { setError(t('auth.weak')); return }
      if (password !== confirmPassword) { setError(t('auth.mismatch')); return }
    }
    // Konverze anonyma (updateUser) captcha nevyžaduje — jinak ji vyžadujeme.
    if (CAPTCHA_ENABLED && !captcha && !(isRegister && isAnonymous)) { setError(t(captchaFailed ? 'auth.captchaFailed' : 'auth.captchaWait')); return }
    setLoading(true)
    try {
      if (isRegister) {
        // Anonym → konverze na plný účet (data zůstanou); jinak nová registrace
        const { error } = isAnonymous
          ? await convertGuestToAccount(email, password)
          : await signUp(email, password, captcha || undefined)
        if (error) throw error
        track('sign_up', { email, converted: isAnonymous })
        if (isAnonymous && user) {
          // Převedený host: zahoď auto „Host####" a nech ho zvolit pravé jméno
          // (reload → UsernameSetup). E-mail potvrdí zvlášť z doručené pošty.
          await clearUsername(user.id)
          window.location.assign('/menu')
          return
        }
        setSuccess(t('auth.registered'))
        setPassword(''); setConfirmPassword('')
      } else {
        const { error } = await signIn(email, password, captcha || undefined)
        if (error) throw error
        track('login', { email })
        navigate('/menu')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('auth.errGeneric')
      if (msg.includes('Invalid login')) setError(t('auth.errInvalid'))
      else if (msg.includes('already registered')) setError(t('auth.errExists'))
      else if (msg.includes('Email not confirmed')) setError(t('auth.errUnconfirmed'))
      else setError(msg)
      resetCaptcha()
    } finally { setLoading(false) }
  }

  async function handleForgot() {
    setError(null); setSuccess(null)
    if (!email) { setError(t('auth.enterEmailFirst')); return }
    if (CAPTCHA_ENABLED && !captcha) { setError(t(captchaFailed ? 'auth.captchaFailed' : 'auth.captchaWait')); return }
    setLoading(true)
    try {
      const { error } = await requestPasswordReset(email, captcha || undefined)
      if (error) throw error
      setSuccess(t('auth.resetSent'))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.errResetFailed'))
    } finally { setLoading(false); resetCaptcha() }
  }

  const isMobile = windowWidth < 768

  const authUI = !isMobile ? (
      <div style={{ position: 'relative', minHeight: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#161009' }}>
        <PanoramaBackdrop/>
        {/* Ztmavovací scrim (radiální + vertikální) — čitelnost formuláře */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(120% 80% at 50% 38%, rgba(22,16,9,.30) 0%, rgba(22,16,9,.72) 58%, rgba(22,16,9,.93) 100%)' }}/>

        {/* Horní lišta */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 40px' }}>
          <Wordmark color="#f5f1e8"/>
          <LanguageSwitcher variant="glass"/>
        </div>

        {/* Střed — vertikálně vycentrovaná karta (scroll na nízkých výškách) */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '72px 24px 32px', overflowY: 'auto' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.2em', color: 'var(--accent)', margin: '0 0 10px', textTransform: 'uppercase', textAlign: 'center' }}>{t('auth.eyebrow')}</p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, color: '#f5f1e8', margin: '0 0 20px', letterSpacing: '-0.02em', lineHeight: 1.08, textAlign: 'center' }}>
            {t('auth.tagline1')}<br/><span style={{ color: 'var(--accent)' }}>{t('auth.tagline2')}</span>
          </h1>

          <div style={{ width: '100%', maxWidth: 500, borderRadius: 22, padding: '26px 28px', background: 'rgba(30,23,15,0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(245,241,232,0.10)', boxShadow: '0 30px 70px -30px rgba(0,0,0,.7)' }}>
            {/* Host — hlavní CTA */}
            <button onClick={startGuest} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--accent)', border: 'none', borderRadius: 14, padding: 17, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16, color: '#fff', cursor: 'pointer', boxShadow: '0 12px 28px -12px rgba(217,119,87,.8)' }}>
              <span>▶</span> {t('auth.guestCta')}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(245,241,232,0.12)' }}/>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', color: 'rgba(245,241,232,0.5)', textTransform: 'uppercase' }}>{t('auth.orSave')}</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(245,241,232,0.12)' }}/>
            </div>

            {/* Tab přihlásit/registrovat */}
            <div style={{ display: 'flex', background: 'rgba(20,15,9,0.5)', borderRadius: 12, padding: 3, marginBottom: 18 }}>
              {(['login', 'register'] as Mode[]).map(m => (
                <button key={m} onClick={() => { setMode(m); setError(null); setSuccess(null) }}
                  style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, background: mode === m ? 'var(--paper-50)' : 'transparent', fontSize: 14, fontWeight: 600, color: mode === m ? 'var(--ink)' : 'rgba(245,241,232,0.6)', cursor: 'pointer', transition: 'all 200ms' }}>
                  {m === 'login' ? t('auth.login') : t('auth.register')}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input className="input" type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"/>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPassword ? 'text' : 'password'} placeholder={isRegister ? t('auth.strongPassword') : '••••••••'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete={isRegister ? 'new-password' : 'current-password'} style={{ paddingRight: 48 }}/>
                <button type="button" onClick={() => setShowPassword(s => !s)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 16 }}>{showPassword ? '🙈' : '👁'}</button>
              </div>
              {isRegister && password.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px' }}>
                  {PASSWORD_RULES.map(rule => (
                    <div key={rule.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: rule.test(password) ? 'var(--success)' : 'rgba(245,241,232,0.55)' }}>
                      <span>{rule.test(password) ? '✓' : '○'}</span>{t(rule.key)}
                    </div>
                  ))}
                </div>
              )}
              {isRegister && (
                <div>
                  <input className={`input${confirmPassword && password !== confirmPassword ? ' input-error' : ''}`} type={showPassword ? 'text' : 'password'} placeholder={t('auth.repeatPassword')} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password"/>
                  {confirmPassword && password !== confirmPassword && <p className="field-error">{t('common.pwMismatch')}</p>}
                </div>
              )}
              {error && <div className="alert alert-error">⚠ {error}</div>}
              {success && <div className="alert alert-success">✓ {success}</div>}
              <button type="submit" className="btn btn-accent" disabled={loading} style={{ width: '100%', padding: '13px 0', fontSize: 15, marginTop: 2, borderRadius: 12 }}>
                {loading ? <><span className="spinner" style={{ width: 16, height: 16 }}/> {t('common.loading')}</> : isRegister ? t('auth.submitCreate') : t('auth.submitLogin')}
              </button>
              {!isRegister && (
                <button type="button" onClick={handleForgot} style={{ ...forgotLinkStyle, alignSelf: 'center', textAlign: 'center', color: 'rgba(245,241,232,0.7)' }}>{t('auth.forgot')}</button>
              )}
            </form>
            <Turnstile key={captchaKey} onToken={setCaptcha} onError={() => setCaptchaFailed(true)} theme="dark" appearance="interaction-only"/>
          </div>
        </div>
      </div>
  ) : (
    // ── Mobil: fullscreen immersive ────────────────────────
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--feature-bg)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Dekorativní pozadí */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {/* Mřížka */}
        <svg style={{ position: 'absolute', inset: 0, opacity: 0.05 }} width="100%" height="100%">
          <defs>
            <pattern id="auth-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="var(--feature-fg)" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-grid)"/>
        </svg>
        {/* Gradient orb */}
        <div style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: '60vw', height: '60vw', maxWidth: 400, maxHeight: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(217,119,87,0.15) 0%, transparent 70%)',
        }}/>
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-10%',
          width: '50vw', height: '50vw', maxWidth: 350, maxHeight: 350,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(90,70,50,0.2) 0%, transparent 70%)',
        }}/>
        {/* Globe dekorace */}
        <svg
          width="260" height="260"
          viewBox="0 0 120 120"
          style={{ position: 'absolute', top: 40, right: -40, opacity: 0.06 }}
        >
          <circle cx="60" cy="60" r="52" stroke="var(--feature-fg)" strokeWidth="0.8" fill="none"/>
          <ellipse cx="60" cy="60" rx="26" ry="52" stroke="var(--feature-fg)" strokeWidth="0.5" fill="none"/>
          <ellipse cx="60" cy="60" rx="48" ry="20" stroke="var(--feature-fg)" strokeWidth="0.5" fill="none"/>
          <line x1="8" y1="60" x2="112" y2="60" stroke="var(--feature-fg)" strokeWidth="0.5"/>
          <line x1="60" y1="8" x2="60" y2="112" stroke="var(--feature-fg)" strokeWidth="0.5"/>
        </svg>
      </div>

      {/* Logo nahoře */}
      <div className="animate-fadeIn" style={{
        padding: 'calc(20px + var(--safe-top)) 24px 0',
        position: 'relative', zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Wordmark/>
        <LanguageSwitcher variant="dark"/>
      </div>

      {/* Tagline — skrytá na mobilu když je málo místa */}
      <div className="animate-fadeUp delay-1" style={{
        padding: '32px 24px 0',
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(28px, 6vw, 42px)',
          color: 'var(--feature-fg)',
          margin: 0,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}>
          {t('auth.tagline1')}<br/>
          <span style={{ color: 'var(--accent)' }}>{t('auth.tagline2')}</span>
        </h1>
        <p style={{
          fontSize: 15, color: 'var(--feature-fg2)',
          margin: 0, lineHeight: 1.5,
          display: 'none', // skrytá — málo místa
        }}>
          Vzdělávací geolokační hra o historii.
        </p>
      </div>

      {/* Auth card — zespoda */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', position: 'relative', zIndex: 1, marginTop: 24 }}>
        <div className="bottom-sheet glass" style={{
          width: '100%',
          padding: '28px 24px',
          paddingBottom: 'max(28px, calc(var(--safe-bottom) + 24px))',
          maxHeight: '80dvh',
          overflowY: 'auto',
        }}>

          {/* Tab přepínač */}
          <div style={{
            display: 'flex', gap: 0,
            background: 'var(--paper-200)',
            borderRadius: 12, padding: 3,
            marginBottom: 28,
          }}>
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); setSuccess(null) }}
                style={{
                  flex: 1, padding: '9px 0',
                  border: 'none', borderRadius: 10,
                  background: mode === m ? 'var(--surface)' : 'transparent',
                  boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
                  fontSize: 14, fontWeight: 500,
                  color: mode === m ? 'var(--ink)' : 'var(--ink-3)',
                  cursor: 'pointer',
                  transition: 'all 200ms var(--ease-out)',
                }}
              >
                {m === 'login' ? t('auth.login') : t('auth.register')}
              </button>
            ))}
          </div>

          {/* Nadpis */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 26, margin: '0 0 4px',
              letterSpacing: '-0.02em',
            }}>
              {isRegister ? t('auth.createAccount') : t('auth.welcomeBack')}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: 0 }}>
              {isRegister ? t('auth.registerSub') : t('auth.loginSub')}
            </p>
          </div>

          {/* Formulář */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">{t('auth.email')}</label>
              <input
                className="input"
                type="email" placeholder="name@example.com"
                value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email"
              />
            </div>

            <div>
              <label className="label">{t('auth.password')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isRegister ? t('auth.strongPassword') : '••••••••'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  style={{ paddingRight: 48 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  style={{
                    position: 'absolute', right: 14, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', color: 'var(--ink-3)',
                    fontSize: 16, padding: 2,
                  }}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>

              {/* Password checklist */}
              {isRegister && password.length > 0 && (
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px' }}>
                  {PASSWORD_RULES.map(rule => (
                    <div
                      key={rule.key}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        fontSize: 12,
                        color: rule.test(password) ? '#1d6b3a' : 'var(--ink-3)',
                        transition: 'color 200ms',
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{rule.test(password) ? '✓' : '○'}</span>
                      {t(rule.key)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!isRegister && (
              <button type="button" onClick={handleForgot} style={forgotLinkStyle}>{t('auth.forgot')}</button>
            )}
            {isRegister && (
              <div>
                <label className="label">{t('auth.confirmPassword')}</label>
                <input
                  className={`input${confirmPassword && password !== confirmPassword ? ' input-error' : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.repeatPassword')}
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  required autoComplete="new-password"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="field-error">{t('common.pwMismatch')}</p>
                )}
              </div>
            )}

            {error && (
              <div className="alert alert-error animate-fadeIn">
                ⚠ {error}
              </div>
            )}
            {success && (
              <div className="alert alert-success animate-fadeIn">
                ✓ {success}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-accent btn-lg"
              disabled={loading}
              style={{ width: '100%', marginTop: 4 }}
            >
              {loading
                ? <><span className="spinner" style={{ width: 16, height: 16 }}/> {t('common.loading')}</>
                : isRegister ? t('auth.submitCreate') : t('auth.submitLogin')
              }
            </button>
          </form>

          <Turnstile key={captchaKey} onToken={setCaptcha} theme="light"/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0 14px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }}/>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>{t('auth.or')}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }}/>
          </div>
          <button onClick={startGuest} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: 'rgba(92,148,104,0.10)', border: '1.5px solid var(--success)', borderRadius: 13, padding: 14, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14.5, color: 'var(--success-deep)', cursor: 'pointer' }}>
            <span style={{ color: 'var(--success)' }}>▶</span> {t('menu.trialTry')}
          </button>

          <DisclaimerBox text={t('auth.disclaimer')}/>

          {/* Legal links */}
          <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
            {t('auth.legal')}{' '}
            <Link to="/terms" style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}>{t('auth.terms')}</Link>
            {' '}{t('auth.and')}{' '}
            <Link to="/privacy" style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}>{t('auth.privacy')}</Link>.
          </p>
        </div>
      </div>
    </div>
  )

  if (!landing) return authUI
  return <>{authUI}<LandingSeo/></>
}

// Lehký, indexovatelný obsah pod přihlašovací stránkou (SEO / AI discoverability).
// Vizuálně tlumený — hlavní je login nahoře; tohle je „pod ohybem".
function LandingSeo() {
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

function DisclaimerBox({ text }: { text: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      background: 'var(--paper-200)', border: '1px solid var(--line)', borderRadius: 14,
      padding: '13px 15px', marginTop: 18,
    }}>
      <span style={{
        flexShrink: 0, width: 18, height: 18, borderRadius: '50%', marginTop: 1,
        border: '1.5px solid var(--ink-3)', color: 'var(--ink-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-serif)', fontSize: 12, fontStyle: 'italic',
      }}>i</span>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-3)' }}>{text}</span>
    </div>
  )
}

function Wordmark({ color = 'var(--feature-fg)' }: { color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color }}>
      <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1.5"/>
        <path d="M16 2 V30" stroke={color} strokeWidth="0.8" opacity="0.5"/>
        <path d="M2 16 H30" stroke={color} strokeWidth="0.8" opacity="0.5"/>
        <path d="M16 2 C8 8 8 24 16 30" stroke={color} strokeWidth="0.8" opacity="0.5" fill="none"/>
        <path d="M16 2 C24 8 24 24 16 30" stroke={color} strokeWidth="0.8" opacity="0.5" fill="none"/>
        <circle cx="16" cy="16" r="2.5" fill={color}/>
      </svg>
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, letterSpacing: '-0.01em', fontWeight: 500, color }}>
        HistoryGuesser
      </span>
    </div>
  )
}
