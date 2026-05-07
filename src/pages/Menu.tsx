import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { signOut } from '@/lib/supabase'

export default function MenuPage() {
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/auth')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>

      {/* Top bar */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 32px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
      }}>
        <Wordmark/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{profile?.username ?? 'Hráč'}</div>
            <div className="eyebrow" style={{ fontSize: 10 }}>{profile?.total_score?.toLocaleString('cs-CZ') ?? 0} bodů</div>
          </div>
          <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 13 }} onClick={handleSignOut}>
            Odhlásit
          </button>
        </div>
      </header>

      {/* Hero */}
      <div style={{ padding: '56px 32px 32px', maxWidth: 900, margin: '0 auto' }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>Vítej zpět</p>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 48, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          {profile?.username ?? 'Hráči'}
        </h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 16, margin: 0 }}>
          Odehráno her: <strong>{profile?.games_played ?? 0}</strong> · Celkové skóre: <strong>{profile?.total_score?.toLocaleString('cs-CZ') ?? 0}</strong>
        </p>
      </div>

      {/* Dlaždice */}
      <div style={{ padding: '0 32px 48px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>

          {/* Hrát */}
          <TileCard
            eyebrow="Klasický mód"
            title="Hrát"
            description="5 kol · historické panoramy · tip místa + roku"
            accent
            icon={<GlobeIcon/>}
            onClick={() => navigate('/game')}
          />

          {/* Účet */}
          <TileCard
            eyebrow="Profil"
            title="Můj účet"
            description="Nastavení, statistiky a změna hesla"
            icon={<UserIcon/>}
            onClick={() => navigate('/account')}
          />

          {/* Admin (pouze pro adminy) */}
          {isAdmin && (
            <TileCard
              eyebrow="Administrace"
              title="Správa událostí"
              description="Přidávat, editovat a publikovat historické události"
              icon={<CogIcon/>}
              onClick={() => navigate('/admin')}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tile Card ─────────────────────────────────────────────
interface TileProps {
  eyebrow: string
  title: string
  description: string
  icon: React.ReactNode
  onClick: () => void
  accent?: boolean
}

function TileCard({ eyebrow, title, description, icon, onClick, accent }: TileProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 12,
        padding: 28,
        background: accent ? 'var(--sepia-900)' : 'var(--surface)',
        border: `1px solid ${accent ? 'transparent' : 'var(--line)'}`,
        borderRadius: 16,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'transform 160ms, box-shadow 160ms',
        boxShadow: 'var(--shadow-sm)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = ''
        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-sm)'
      }}
    >
      <div style={{
        width: 44, height: 44,
        borderRadius: 12,
        background: accent ? 'rgba(255,255,255,0.1)' : 'var(--paper-200)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent ? 'var(--accent-soft)' : 'var(--accent)',
      }}>
        {icon}
      </div>
      <div>
        <div className="eyebrow" style={{ color: accent ? 'rgba(245,241,232,0.5)' : undefined, marginBottom: 4 }}>{eyebrow}</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: accent ? 'var(--paper-50)' : 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: accent ? 'rgba(245,241,232,0.6)' : 'var(--ink-3)', lineHeight: 1.5 }}>{description}</div>
      </div>
    </button>
  )
}

function Wordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M16 2 V30" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/>
        <path d="M2 16 H30" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/>
        <path d="M16 2 C8 8 8 24 16 30" stroke="currentColor" strokeWidth="0.8" opacity="0.5" fill="none"/>
        <path d="M16 2 C24 8 24 24 16 30" stroke="currentColor" strokeWidth="0.8" opacity="0.5" fill="none"/>
        <circle cx="16" cy="16" r="2.5" fill="currentColor"/>
      </svg>
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, letterSpacing: '-0.01em' }}>HistoryGuessr</span>
    </div>
  )
}

function GlobeIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2c3 3 4.5 6.3 4.5 10S15 19 12 22c-3-3-4.5-6.3-4.5-10S9 5 12 2Z"/></svg>
}
function UserIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
}
function CogIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>
}
