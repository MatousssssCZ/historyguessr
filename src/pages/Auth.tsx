import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn, signUp } from '@/lib/supabase'

type Mode = 'login' | 'register'

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8,          label: 'Alespoň 8 znaků' },
  { test: (p: string) => /[A-Z]/.test(p),        label: '1 velké písmeno' },
  { test: (p: string) => /[0-9]/.test(p),        label: '1 číslo' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: '1 speciální znak' },
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (isRegister) {
      if (!passwordValid) { setError('Heslo nesplňuje požadavky.'); return }
      if (password !== confirmPassword) { setError('Hesla se neshodují.'); return }
    }

    setLoading(true)
    try {
      if (isRegister) {
        const { error } = await signUp(email, password)
        if (error) throw error
        setSuccess('Registrace úspěšná! Zkontroluj svůj e-mail a potvrď účet.')
        setPassword(''); setConfirmPassword('')
      } else {
        const { error } = await signIn(email, password)
        if (error) throw error
        navigate('/menu')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nastala chyba.'
      if (msg.includes('Invalid login')) setError('Nesprávný e-mail nebo heslo.')
      else if (msg.includes('already registered')) setError('Tento e-mail je již zaregistrován.')
      else if (msg.includes('Email not confirmed')) setError('Nejprve potvrď svůj e-mail.')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--paper-200)' }} className="auth-grid">

      {/* ── Levá strana — dekorativní (skrytá na mobilu) ── */}
      <div style={{
        background: 'var(--sepia-900)',
        padding: 48,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }} className="auth-left-panel">
        {/* Dekorativní pozadí */}
        <svg style={{ position: 'absolute', inset: 0, opacity: 0.06 }} width="100%" height="100%">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f5f1e8" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)"/>
        </svg>

        {/* Logo */}
        <div style={{ position: 'relative' }}>
          <Wordmark color="#f5f1e8"/>
        </div>

        {/* Quote */}
        <div style={{ position: 'relative' }}>
          <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 16 }}>Motto</div>
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 22,
            color: 'var(--paper-100)',
            lineHeight: 1.5,
            margin: 0,
            maxWidth: 340,
          }}>
            "Kdo nezná historii, je odsouzen ji znovu prožívat."
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--sepia-500)', marginTop: 12 }}>
            — George Santayana
          </p>
        </div>

        {/* Dekorativní glóbus */}
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ position: 'absolute', bottom: 40, right: 40, opacity: 0.15 }}>
          <circle cx="60" cy="60" r="52" stroke="#f5f1e8" strokeWidth="1" fill="none"/>
          <ellipse cx="60" cy="60" rx="30" ry="52" stroke="#f5f1e8" strokeWidth="0.7" fill="none"/>
          <line x1="8" y1="60" x2="112" y2="60" stroke="#f5f1e8" strokeWidth="0.7"/>
          <line x1="60" y1="8" x2="60" y2="112" stroke="#f5f1e8" strokeWidth="0.7"/>
        </svg>
      </div>

      {/* ── Pravá strana — formulář ── */}
      <div style={{
        padding: '48px 56px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: 'var(--paper-50)',
      }}>
        {/* Tab přepínač */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 40, background: 'var(--paper-200)', borderRadius: 10, padding: 4 }}>
          {(['login', 'register'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); setSuccess(null) }}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                borderRadius: 7,
                background: mode === m ? 'var(--surface)' : 'transparent',
                boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                fontWeight: 500,
                color: mode === m ? 'var(--ink)' : 'var(--ink-3)',
                cursor: 'pointer',
                transition: 'all 160ms',
              }}
            >
              {m === 'login' ? 'Přihlásit se' : 'Registrovat'}
            </button>
          ))}
        </div>

        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          {isRegister ? 'Vytvořit účet' : 'Vítej zpět'}
        </h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14, margin: '0 0 32px' }}>
          {isRegister ? 'Zaregistruj se a začni hádat historii.' : 'Přihlaš se a pokračuj ve hře.'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label className="label">E-mail</label>
            <input
              className={`input${error && !email ? ' input-error' : ''}`}
              type="email"
              placeholder="jan@example.cz"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="label">Heslo</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                placeholder={isRegister ? 'Silné heslo…' : '••••••••'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4 }}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>

            {/* Password strength checklist (jen při registraci) */}
            {isRegister && password.length > 0 && (
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {PASSWORD_RULES.map(rule => (
                  <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: rule.test(password) ? '#1d6b3a' : 'var(--ink-3)', transition: 'color 200ms' }}>
                    <span>{rule.test(password) ? '✓' : '○'}</span>
                    {rule.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {isRegister && (
            <div>
              <label className="label">Potvrdit heslo</label>
              <input
                className={`input${confirmPassword && password !== confirmPassword ? ' input-error' : ''}`}
                type={showPassword ? 'text' : 'password'}
                placeholder="Zopakuj heslo"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="field-error">Hesla se neshodují</p>
              )}
            </div>
          )}

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <button
            type="submit"
            className="btn btn-accent"
            disabled={loading}
            style={{ width: '100%', marginTop: 4, padding: '13px 0', fontSize: 15 }}
          >
            {loading ? <span className="spinner" style={{ width: 16, height: 16 }}/> : null}
            {loading ? 'Moment…' : isRegister ? 'Vytvořit účet' : 'Přihlásit se'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Mini Wordmark (lokální, bez window globals) ────────────
function Wordmark({ color = 'currentColor' }: { color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color }}>
      <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1.5"/>
        <path d="M16 2 V30" stroke={color} strokeWidth="0.8" opacity="0.5"/>
        <path d="M2 16 H30" stroke={color} strokeWidth="0.8" opacity="0.5"/>
        <path d="M16 2 C8 8 8 24 16 30" stroke={color} strokeWidth="0.8" opacity="0.5" fill="none"/>
        <path d="M16 2 C24 8 24 24 16 30" stroke={color} strokeWidth="0.8" opacity="0.5" fill="none"/>
        <circle cx="16" cy="16" r="2.5" fill={color}/>
      </svg>
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, letterSpacing: '-0.01em', fontWeight: 500 }}>
        HistoryGuessr
      </span>
    </div>
  )
}
