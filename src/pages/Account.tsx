import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { updateProfile, signOut } from '@/lib/supabase'
import { validateUsername, USERNAME_MAX } from '@/lib/username'
import ThemeToggle from '@/components/ThemeToggle'
import BackButton from '@/components/BackButton'

export default function AccountPage() {
  const { t } = useTranslation()
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState(profile?.username ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const v = validateUsername(username)
    if (!v.ok) { setMessage({ type: 'error', text: t('setup.' + v.error) }); return }
    setSaving(true); setMessage(null)
    const { error } = await updateProfile(user.id, { username: v.value })
    setSaving(false)
    if (!error) setUsername(v.value)
    setMessage(error
      ? { type: 'error', text: (error as { code?: string }).code === '23505' ? t('setup.taken') : t('account.saveError') }
      : { type: 'success', text: t('account.saved') }
    )
  }

  async function handleSignOut() {
    await signOut()
    navigate('/auth')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>
      {/* Top bar */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '16px 32px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
      }}>
        <BackButton onClick={() => navigate('/menu')} label={t('common.back')} />
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>{t('account.title')}</h1>
      </header>

      <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 24px' }}>

        {/* Profil */}
        <div className="card" style={{ padding: 28, marginBottom: 24 }}>
          <p className="eyebrow" style={{ marginBottom: 20 }}>{t('account.profile')}</p>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">{t('auth.email')}</label>
              <input className="input" value={user?.email ?? ''} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}/>
            </div>
            <div>
              <label className="label">{t('account.username')}</label>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder={t('account.usernamePlaceholder')} maxLength={USERNAME_MAX}/>
            </div>
            {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? <span className="spinner" style={{ width: 16, height: 16 }}/> : null}
              {saving ? t('account.saving') : t('common.save')}
            </button>
          </form>
        </div>

        {/* Vzhled */}
        <div className="card" style={{ padding: 28, marginBottom: 24 }}>
          <p className="eyebrow" style={{ marginBottom: 16 }}>{t('account.appearance')}</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>{t('account.themeLabel')}</span>
            <ThemeToggle/>
          </div>
        </div>

        {/* Odhlášení */}
        <div className="card" style={{ padding: 28 }}>
          <p className="eyebrow" style={{ marginBottom: 12 }}>{t('account.session')}</p>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 16 }}>
            {t('account.loggedInAs')} <strong>{user?.email}</strong>
          </p>
          <button className="btn btn-danger" onClick={handleSignOut}>
            {t('account.signOut')}
          </button>
        </div>
      </div>
    </div>
  )
}
