import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { updateProfile, signOut } from '@/lib/supabase'

export default function AccountPage() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState(profile?.username ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true); setMessage(null)
    const { error } = await updateProfile(user.id, { username })
    setSaving(false)
    setMessage(error
      ? { type: 'error', text: 'Nepodařilo se uložit.' }
      : { type: 'success', text: 'Profil uložen.' }
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
        <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navigate('/menu')}>
          ← Zpět
        </button>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>Můj účet</h1>
      </header>

      <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 24px' }}>

        {/* Statistiky */}
        <div className="card" style={{ padding: 28, marginBottom: 24 }}>
          <p className="eyebrow" style={{ marginBottom: 20 }}>Statistiky</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <StatBlock label="Celkové skóre" value={profile?.total_score?.toLocaleString('cs-CZ') ?? '0'}/>
            <StatBlock label="Odehráno her" value={String(profile?.games_played ?? 0)}/>
          </div>
        </div>

        {/* Profil */}
        <div className="card" style={{ padding: 28, marginBottom: 24 }}>
          <p className="eyebrow" style={{ marginBottom: 20 }}>Profil</p>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">E-mail</label>
              <input className="input" value={user?.email ?? ''} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}/>
            </div>
            <div>
              <label className="label">Uživatelské jméno</label>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="např. historik42" maxLength={32}/>
            </div>
            {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? <span className="spinner" style={{ width: 16, height: 16 }}/> : null}
              {saving ? 'Ukládám…' : 'Uložit změny'}
            </button>
          </form>
        </div>

        {/* Odhlášení */}
        <div className="card" style={{ padding: 28 }}>
          <p className="eyebrow" style={{ marginBottom: 12 }}>Relace</p>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 16 }}>
            Přihlášen jako <strong>{user?.email}</strong>
          </p>
          <button className="btn btn-danger" onClick={handleSignOut}>
            Odhlásit se
          </button>
        </div>
      </div>
    </div>
  )
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  )
}
