import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { supabase, updatePassword } from '@/lib/supabase'

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8, key: 'auth.rule8' },
  { test: (p: string) => /[A-Z]/.test(p), key: 'auth.ruleUpper' },
  { test: (p: string) => /[0-9]/.test(p), key: 'auth.ruleNum' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), key: 'auth.ruleSpecial' },
]

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)

  // Supabase z odkazu vytvoří „recovery" session (detectSessionInUrl)
  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setReady(!!data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [])

  const valid = PASSWORD_RULES.every(r => r.test(password))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!valid) { setError(t('auth.weak')); return }
    if (password !== confirm) { setError(t('auth.mismatch')); return }
    setLoading(true)
    try {
      const { error } = await updatePassword(password)
      if (error) throw error
      setDone(true)
      setTimeout(() => navigate('/menu'), 1800)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('reset.failed'))
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 'clamp(24px, 6vw, 36px)', boxShadow: 'var(--shadow-lg)' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', color: 'var(--accent-deep)', textTransform: 'uppercase', margin: 0 }}>HistoryGuessr</p>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, letterSpacing: '-0.02em', margin: '8px 0 6px' }}>{t('reset.title')}</h1>

        {done ? (
          <div className="alert alert-success" style={{ marginTop: 16 }}>{t('reset.done')}</div>
        ) : !ready ? (
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 12, lineHeight: 1.6 }}>
            {t('reset.verifying')}
          </p>
        ) : (
          <>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: '0 0 22px', lineHeight: 1.5 }}>{t('reset.sub')}</p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="label">{t('reset.newPassword')}</label>
                <div style={{ position: 'relative' }}>
                  <input className="input" type={show ? 'text' : 'password'} placeholder={t('auth.strongPassword')} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" style={{ paddingRight: 48 }}/>
                  <button type="button" onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 16 }}>{show ? '🙈' : '👁'}</button>
                </div>
                {password.length > 0 && (
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px' }}>
                    {PASSWORD_RULES.map(rule => (
                      <div key={t(rule.key)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: rule.test(password) ? '#1d6b3a' : 'var(--ink-3)' }}>
                        <span>{rule.test(password) ? '✓' : '○'}</span>{t(rule.key)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="label">{t('auth.confirmPassword')}</label>
                <input className={`input${confirm && password !== confirm ? ' input-error' : ''}`} type={show ? 'text' : 'password'} placeholder={t('auth.repeatPassword')} value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password"/>
                {confirm && password !== confirm && <p className="field-error">{t('auth.mismatch')}</p>}
              </div>
              {error && <div className="alert alert-error">⚠ {error}</div>}
              <button type="submit" className="btn btn-accent" disabled={loading} style={{ width: '100%', padding: '14px 0', fontSize: 16, borderRadius: 12 }}>
                {loading ? <><span className="spinner" style={{ width: 16, height: 16 }}/> {t('common.loading')}</> : t('reset.submit')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
