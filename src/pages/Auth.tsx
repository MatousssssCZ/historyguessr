import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { signIn, signUp, requestPasswordReset, track } from '@/lib/supabase'
import LanguageSwitcher from '@/components/LanguageSwitcher'

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

export default function AuthPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>((location.state as { mode?: Mode } | null)?.mode === 'register' ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

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
    setLoading(true)
    try {
      if (isRegister) {
        const { error } = await signUp(email, password)
        if (error) throw error
        setSuccess(t('auth.registered'))
        setPassword(''); setConfirmPassword('')
        track('sign_up', { email })
      } else {
        const { error } = await signIn(email, password)
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
    } finally { setLoading(false) }
  }

  async function handleForgot() {
    setError(null); setSuccess(null)
    if (!email) { setError(t('auth.enterEmailFirst')); return }
    setLoading(true)
    try {
      const { error } = await requestPasswordReset(email)
      if (error) throw error
      setSuccess(t('auth.resetSent'))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.errResetFailed'))
    } finally { setLoading(false) }
  }

  const isMobile = windowWidth < 768

  if (!isMobile) {
    // ── Desktop: split layout ──────────────────────────────
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--feature-bg)' }}>

        {/* Levá — branding */}
        <div style={{ position: 'relative', padding: 56, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
          <svg style={{ position: 'absolute', inset: 0, opacity: 0.05 }} width="100%" height="100%">
            <defs><pattern id="auth-grid-d" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M 48 0 L 0 0 0 48" fill="none" stroke="var(--feature-fg)" strokeWidth="0.5"/></pattern></defs>
            <rect width="100%" height="100%" fill="url(#auth-grid-d)"/>
          </svg>
          <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '70%', height: '70%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,119,87,0.12) 0%, transparent 70%)', pointerEvents: 'none' }}/>
          <svg width="320" height="320" viewBox="0 0 120 120" style={{ position: 'absolute', bottom: -40, right: -60, opacity: 0.06 }}>
            <circle cx="60" cy="60" r="52" stroke="var(--feature-fg)" strokeWidth="0.8" fill="none"/>
            <ellipse cx="60" cy="60" rx="26" ry="52" stroke="var(--feature-fg)" strokeWidth="0.5" fill="none"/>
            <ellipse cx="60" cy="60" rx="48" ry="20" stroke="var(--feature-fg)" strokeWidth="0.5" fill="none"/>
            <line x1="8" y1="60" x2="112" y2="60" stroke="var(--feature-fg)" strokeWidth="0.5"/>
            <line x1="60" y1="8" x2="60" y2="112" stroke="var(--feature-fg)" strokeWidth="0.5"/>
          </svg>
          <div style={{ position: 'relative' }}><Wordmark/></div>
          <div style={{ position: 'relative' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', color: 'var(--accent)', margin: '0 0 20px', textTransform: 'uppercase' }}>{t('auth.eyebrow')}</p>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 44, color: 'var(--feature-fg)', margin: '0 0 16px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {t('auth.tagline1')}<br/><span style={{ color: 'var(--accent)' }}>{t('auth.tagline2')}</span>
            </h1>
            <p style={{ fontSize: 16, color: 'var(--feature-fg2)', margin: '0 0 40px', lineHeight: 1.6 }}>
              {t('auth.bullet')}
            </p>
            <blockquote style={{ margin: 0, borderLeft: '2px solid rgba(217,119,87,0.4)', paddingLeft: 20 }}>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--feature-fg2)', margin: '0 0 8px', lineHeight: 1.5 }}>
                {t('auth.quote')}
              </p>
              <cite style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--feature-fg3)', letterSpacing: '0.1em' }}>{t('auth.quoteAuthor')}</cite>
            </blockquote>
          </div>
          <div style={{ position: 'relative' }}/>
        </div>

        {/* Pravá — formulář */}
        <div style={{ background: 'var(--paper-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: '100%', maxWidth: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <LanguageSwitcher/>
            </div>
            {/* Tab */}
            <div style={{ display: 'flex', background: 'var(--paper-200)', borderRadius: 12, padding: 3, marginBottom: 36 }}>
              {(['login', 'register'] as Mode[]).map(m => (
                <button key={m} onClick={() => { setMode(m); setError(null); setSuccess(null) }}
                  style={{ flex: 1, padding: '9px 0', border: 'none', borderRadius: 10, background: mode === m ? 'var(--surface)' : 'transparent', boxShadow: mode === m ? 'var(--shadow-sm)' : 'none', fontSize: 14, fontWeight: 500, color: mode === m ? 'var(--ink)' : 'var(--ink-3)', cursor: 'pointer', transition: 'all 200ms' }}>
                  {m === 'login' ? t('auth.login') : t('auth.register')}
                </button>
              ))}
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              {isRegister ? t('auth.createAccount') : t('auth.welcomeBack')}
            </h2>
            <p style={{ fontSize: 15, color: 'var(--ink-3)', margin: '0 0 28px' }}>
              {isRegister ? t('auth.registerSub') : t('auth.loginSub')}
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label className="label">{t('auth.email')}</label>
                <input className="input" type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"/>
              </div>
              <div>
                <label className="label">{t('auth.password')}</label>
                <div style={{ position: 'relative' }}>
                  <input className="input" type={showPassword ? 'text' : 'password'} placeholder={isRegister ? t('auth.strongPassword') : '••••••••'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete={isRegister ? 'new-password' : 'current-password'} style={{ paddingRight: 48 }}/>
                  <button type="button" onClick={() => setShowPassword(s => !s)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 16 }}>{showPassword ? '🙈' : '👁'}</button>
                </div>
                {isRegister && password.length > 0 && (
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px' }}>
                    {PASSWORD_RULES.map(rule => (
                      <div key={rule.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: rule.test(password) ? '#1d6b3a' : 'var(--ink-3)', transition: 'color 200ms' }}>
                        <span>{rule.test(password) ? '✓' : '○'}</span>{t(rule.key)}
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
                  <input className={`input${confirmPassword && password !== confirmPassword ? ' input-error' : ''}`} type={showPassword ? 'text' : 'password'} placeholder={t('auth.repeatPassword')} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password"/>
                  {confirmPassword && password !== confirmPassword && <p className="field-error">{t('common.pwMismatch')}</p>}
                </div>
              )}
              {error && <div className="alert alert-error">⚠ {error}</div>}
              {success && <div className="alert alert-success">✓ {success}</div>}
              <button type="submit" className="btn btn-accent" disabled={loading} style={{ width: '100%', padding: '14px 0', fontSize: 16, marginTop: 4, borderRadius: 12 }}>
                {loading ? <><span className="spinner" style={{ width: 16, height: 16 }}/> {t('common.loading')}</> : isRegister ? t('auth.submitCreate') : t('auth.submitLogin')}
              </button>
            </form>
            <button onClick={() => navigate('/try')} style={{ width: '100%', marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: 'transparent', border: '1.5px solid var(--line-strong)', borderRadius: 12, padding: 13, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', cursor: 'pointer' }}>
              <span style={{ color: 'var(--accent)' }}>▶</span> {t('menu.trialTry')}
            </button>
            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-3)', marginTop: 9 }}>{t('menu.trialFree')}</div>
            <DisclaimerBox text={t('auth.disclaimer')}/>
          </div>
        </div>
      </div>
    )
  }

  // ── Mobil: fullscreen immersive ────────────────────────
  return (
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

          <button onClick={() => navigate('/try')} style={{ width: '100%', marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: 'transparent', border: '1.5px solid var(--line-strong)', borderRadius: 13, padding: 12, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', cursor: 'pointer' }}>
            <span style={{ color: 'var(--accent)' }}>▶</span> {t('menu.trialTry')}
          </button>
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>{t('menu.trialFree')}</div>

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
        HistoryGuessr
      </span>
    </div>
  )
}
