import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { updateProfile } from '@/lib/supabase'
import { validateUsername, USERNAME_MAX } from '@/lib/username'

// Vynucené nastavení přezdívky — zobrazí se přihlášenému uživateli,
// který ještě nemá username (první přihlášení nebo historický účet bez ní).
export default function UsernameSetup() {
  const { t } = useTranslation()
  const { user, refreshProfile } = useAuth()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = validateUsername(name)
    if (!v.ok) { setError(t('setup.' + v.error)); return }
    if (!user) return
    setSaving(true); setError(null)
    const { error: err } = await updateProfile(user.id, { username: v.value })
    if (err) {
      setSaving(false)
      // unikátní index na username → 23505
      setError((err as { code?: string }).code === '23505' ? t('setup.taken') : t('setup.error'))
      return
    }
    await refreshProfile()
    // refreshProfile přepne gate; saving necháme true (komponenta zmizí)
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-200)', padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 32 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>👋</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{t('setup.title')}</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: '0 0 22px' }}>{t('setup.sub')}</p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            className="input" value={name} onChange={e => setName(e.target.value)}
            placeholder={t('setup.placeholder')} maxLength={USERNAME_MAX} autoFocus
          />
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-accent" type="submit" disabled={saving || name.trim().length < 3}>
            {saving ? <span className="spinner" style={{ width: 16, height: 16 }}/> : null}
            {t('setup.confirm')}
          </button>
        </form>
        <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 14 }}>{t('setup.hint')}</p>
      </div>
    </div>
  )
}
