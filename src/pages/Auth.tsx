import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signIn, signUp, requestPasswordReset, track } from '@/lib/supabase'

const forgotLinkStyle: React.CSSProperties = {
  alignSelf: 'flex-end', background: 'none', border: 'none', padding: 0,
  marginTop: -6, color: 'var(--ink-3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
}

type Mode = 'login' | 'register'

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8,           label: 'Alespoň 8 znaků' },
  { test: (p: string) => /[A-Z]/.test(p),         label: '1 velké písmeno' },
  { test: (p: string) => /[0-9]/.test(p),         label: '1 číslo' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p),  label: '1 speciální znak' },
]

export default function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
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
      if (!passwordValid) { setError('Heslo nesplňuje požadavky.'); return }
      if (password !== confirmPassword) { setError('Hesla se neshodují.'); return }
    }
    setLoading(true)
    try {
      if (isRegister) {
        const { error } = await signUp(email, password)
        if (error) throw error
        setSuccess('Registrace úspěšná! Zkontroluj svůj e-mail.')
        setPassword(''); setConfirmPassword('')
        track('sign_up', { email })
      } else {
        const { error } = await signIn(email, password)
        if (error) throw error
        track('login', { email })
        navigate('/menu')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nastala chyba.'
      if (msg.includes('Invalid login')) setError('Nesprávný e-mail nebo heslo.')
      else if (msg.includes('already registered')) setError('Tento e-mail je již zaregistrován.')
      else if (msg.includes('Email not confirmed')) setError('Nejprve potvrď svůj e-mail.')
      else setError(msg)
    } finally { setLoading(false) }
  }

  async function handleForgot() {
    setError(null); setSuccess(null)
    if (!email) { setError('Zadej nejdřív svůj e-mail.'); return }
    setLoading(true)
    try {
      const { error } = await requestPasswordReset(email)
      if (error) throw error
      setSuccess('Poslali jsme ti e-mail s odkazem na obnovu hesla.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se odeslat e-mail.')
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
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', color: 'var(--accent)', margin: '0 0 20px', textTransform: 'uppercase' }}>Vzdělávací geolokační hra</p>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 44, color: 'var(--feature-fg)', margin: '0 0 16px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              Hádej historii.<br/><span style={{ color: 'var(--accent)' }}>Trefuj čas a místo.</span>
            </h1>
            <p style={{ fontSize: 16, color: 'var(--feature-fg2)', margin: '0 0 40px', lineHeight: 1.6 }}>
              5 kol · 360° panoramy · tip místa + roku
            </p>
            <blockquote style={{ margin: 0, borderLeft: '2px solid rgba(217,119,87,0.4)', paddingLeft: 20 }}>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--feature-fg2)', margin: '0 0 8px', lineHeight: 1.5 }}>
                "Kdo nezná historii, je odsouzen ji znovu prožívat."
              </p>
              <cite style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--feature-fg3)', letterSpacing: '0.1em' }}>— George Santayana</cite>
            </blockquote>
          </div>
          <div style={{ position: 'relative' }}/>
        </div>

        {/* Pravá — formulář */}
        <div style={{ background: 'var(--paper-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: '100%', maxWidth: 400 }}>
            {/* Tab */}
            <div style={{ display: 'flex', background: 'var(--paper-200)', borderRadius: 12, padding: 3, marginBottom: 36 }}>
              {(['login', 'register'] as Mode[]).map(m => (
                <button key={m} onClick={() => { setMode(m); setError(null); setSuccess(null) }}
                  style={{ flex: 1, padding: '9px 0', border: 'none', borderRadius: 10, background: mode === m ? 'var(--surface)' : 'transparent', boxShadow: mode === m ? 'var(--shadow-sm)' : 'none', fontSize: 14, fontWeight: 500, color: mode === m ? 'var(--ink)' : 'var(--ink-3)', cursor: 'pointer', transition: 'all 200ms' }}>
                  {m === 'login' ? 'Přihlásit se' : 'Registrovat'}
                </button>
              ))}
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              {isRegister ? 'Vytvoř si účet' : 'Vítej zpět'}
            </h2>
            <p style={{ fontSize: 15, color: 'var(--ink-3)', margin: '0 0 28px' }}>
              {isRegister ? 'Zaregistruj se a začni hádat historii.' : 'Přihlaš se a pokračuj ve hře.'}
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label className="label">E-mail</label>
                <input className="input" type="email" placeholder="jan@example.cz" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"/>
              </div>
              <div>
                <label className="label">Heslo</label>
                <div style={{ position: 'relative' }}>
                  <input className="input" type={showPassword ? 'text' : 'password'} placeholder={isRegister ? 'Silné heslo…' : '••••••••'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete={isRegister ? 'new-password' : 'current-password'} style={{ paddingRight: 48 }}/>
                  <button type="button" onClick={() => setShowPassword(s => !s)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 16 }}>{showPassword ? '🙈' : '👁'}</button>
                </div>
                {isRegister && password.length > 0 && (
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px' }}>
                    {PASSWORD_RULES.map(rule => (
                      <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: rule.test(password) ? '#1d6b3a' : 'var(--ink-3)', transition: 'color 200ms' }}>
                        <span>{rule.test(password) ? '✓' : '○'}</span>{rule.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {!isRegister && (
                <button type="button" onClick={handleForgot} style={forgotLinkStyle}>Zapomněl jsi heslo?</button>
              )}
              {isRegister && (
                <div>
                  <label className="label">Potvrdit heslo</label>
                  <input className={`input${confirmPassword && password !== confirmPassword ? ' input-error' : ''}`} type={showPassword ? 'text' : 'password'} placeholder="Zopakuj heslo" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password"/>
                  {confirmPassword && password !== confirmPassword && <p className="field-error">Hesla se neshodují</p>}
                </div>
              )}
              {error && <div className="alert alert-error">⚠ {error}</div>}
              {success && <div className="alert alert-success">✓ {success}</div>}
              <button type="submit" className="btn btn-accent" disabled={loading} style={{ width: '100%', padding: '14px 0', fontSize: 16, marginTop: 4, borderRadius: 12 }}>
                {loading ? <><span className="spinner" style={{ width: 16, height: 16 }}/> Moment…</> : isRegister ? 'Vytvořit účet →' : 'Přihlásit se →'}
              </button>
            </form>
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
      }}>
        <Wordmark/>
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
          Hádej historii.<br/>
          <span style={{ color: 'var(--accent)' }}>Trefuj čas a místo.</span>
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
                {m === 'login' ? 'Přihlásit se' : 'Registrovat'}
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
              {isRegister ? 'Vytvoř si účet' : 'Vítej zpět'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: 0 }}>
              {isRegister ? 'Zaregistruj se a začni hádat historii.' : 'Přihlaš se a pokračuj ve hře.'}
            </p>
          </div>

          {/* Formulář */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">E-mail</label>
              <input
                className="input"
                type="email" placeholder="jan@example.cz"
                value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email"
              />
            </div>

            <div>
              <label className="label">Heslo</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isRegister ? 'Silné heslo…' : '••••••••'}
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
                      key={rule.label}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        fontSize: 12,
                        color: rule.test(password) ? '#1d6b3a' : 'var(--ink-3)',
                        transition: 'color 200ms',
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{rule.test(password) ? '✓' : '○'}</span>
                      {rule.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!isRegister && (
              <button type="button" onClick={handleForgot} style={forgotLinkStyle}>Zapomněl jsi heslo?</button>
            )}
            {isRegister && (
              <div>
                <label className="label">Potvrdit heslo</label>
                <input
                  className={`input${confirmPassword && password !== confirmPassword ? ' input-error' : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Zopakuj heslo"
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  required autoComplete="new-password"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="field-error">Hesla se neshodují</p>
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
                ? <><span className="spinner" style={{ width: 16, height: 16 }}/> Moment…</>
                : isRegister ? 'Vytvořit účet →' : 'Přihlásit se →'
              }
            </button>
          </form>

          {/* Legal links */}
          <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
            Používáním aplikace souhlasíš s{' '}
            <Link to="/terms" style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}>podmínkami použití</Link>
            {' '}a{' '}
            <Link to="/privacy" style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}>zásadami ochrany údajů</Link>.
          </p>
        </div>
      </div>
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
