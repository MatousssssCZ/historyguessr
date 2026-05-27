import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { signOut } from '@/lib/supabase'

export default function MenuPage() {
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    const h = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', h)
    return () => { clearTimeout(t); window.removeEventListener('resize', h) }
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/auth')
  }

  const games = profile?.games_played ?? 0
  const score = profile?.total_score?.toLocaleString('cs-CZ') ?? '0'
  const name = profile?.username ?? 'Hráči'

  const isMobile = windowWidth < 768

  // ── Desktop layout ────────────────────────────────────
  if (!isMobile) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--sepia-900)', position: 'relative', overflow: 'hidden' }}>
        {/* Dekorativní pozadí */}
        <svg style={{ position: 'absolute', inset: 0, opacity: 0.04, pointerEvents: 'none' }} width="100%" height="100%">
          <defs><pattern id="menu-grid-d" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M 36 0 L 0 0 0 36" fill="none" stroke="#f5f1e8" strokeWidth="0.5"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#menu-grid-d)"/>
        </svg>
        <div style={{ position: 'absolute', top: '-20%', right: '-5%', width: '50vw', height: '50vw', maxWidth: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,119,87,0.08) 0%, transparent 70%)', pointerEvents: 'none' }}/>

        {/* Header */}
        <header style={{ position: 'relative', zIndex: 1, padding: '20px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Wordmark/>
          <button onClick={handleSignOut} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: 'rgba(245,241,232,0.5)', cursor: 'pointer', transition: 'all 160ms' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}>
            Odhlásit
          </button>
        </header>

        {/* Centrovaný obsah */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 960, margin: '0 auto', padding: '64px 48px 48px' }}>
          {/* Greeting */}
          <div style={{ marginBottom: 48, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(16px)', transition: 'all 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.18em', color: 'var(--accent)', margin: '0 0 12px', textTransform: 'uppercase' }}>Vítej zpět</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 56, color: 'var(--paper-50)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1 }}>{name}</h1>
              <div style={{ display: 'flex', gap: 10, paddingBottom: 8 }}>
                <StatBadge value={String(games)} label="her"/>
                <StatBadge value={score} label="bodů" accent/>
              </div>
            </div>
          </div>

          {/* Cards grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(20px)', transition: 'all 0.5s 0.1s cubic-bezier(0.16,1,0.3,1)' }}>
            <PlayCard onClick={() => navigate('/game')}/>
            <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1fr 1fr' : '1fr 1fr', gap: 16 }}>
              <SmallCard icon="👤" title="Účet" sub="Profil & statistiky" onClick={() => navigate('/account')}/>
              {isAdmin && <SmallCard icon="⚙️" title="Admin" sub="Správa událostí" onClick={() => navigate('/admin')} accent/>}
              <SmallCard icon="🏆" title="Skóre" sub={`${games} her · max 50 000`} onClick={() => navigate('/account')}/>
            </div>
          </div>

          <p style={{ textAlign: 'center', fontFamily: 'var(--font-serif)', fontSize: 14, color: 'rgba(245,241,232,0.25)', lineHeight: 1.6, marginTop: 40 }}>
            "Kdo nezná historii, je odsouzen ji znovu prožívat." — <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>George Santayana</span>
          </p>
        </div>
      </div>
    )
  }

  // ── Mobil layout ──────────────────────────────────────
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex', flexDirection: 'column',
      background: 'var(--sepia-900)',
      overflow: 'hidden',
    }}>

      {/* ── Hero — tmavý ── */}
      <div style={{ position: 'relative', padding: 'calc(var(--safe-top) + 16px) 20px 0', flexShrink: 0 }}>

        {/* Dekorativní pozadí */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <svg style={{ position: 'absolute', inset: 0, opacity: 0.04 }} width="100%" height="100%">
            <defs>
              <pattern id="menu-grid" width="36" height="36" patternUnits="userSpaceOnUse">
                <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#f5f1e8" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#menu-grid)"/>
          </svg>
          <div style={{
            position: 'absolute', top: -80, right: -80,
            width: 280, height: 280, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(217,119,87,0.10) 0%, transparent 70%)',
          }}/>
          <svg width="220" height="220" viewBox="0 0 120 120"
            style={{ position: 'absolute', top: -20, right: -30, opacity: 0.05 }}>
            <circle cx="60" cy="60" r="52" stroke="#f5f1e8" strokeWidth="0.8" fill="none"/>
            <ellipse cx="60" cy="60" rx="26" ry="52" stroke="#f5f1e8" strokeWidth="0.5" fill="none"/>
            <ellipse cx="60" cy="60" rx="48" ry="20" stroke="#f5f1e8" strokeWidth="0.5" fill="none"/>
            <line x1="8" y1="60" x2="112" y2="60" stroke="#f5f1e8" strokeWidth="0.5"/>
            <line x1="60" y1="8" x2="60" y2="112" stroke="#f5f1e8" strokeWidth="0.5"/>
          </svg>
        </div>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, position: 'relative' }}>
          <Wordmark/>
          <button
            onClick={handleSignOut}
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, padding: '7px 14px', fontSize: 13,
              color: 'rgba(245,241,232,0.55)', cursor: 'pointer',
              transition: 'all 160ms',
            }}
          >
            Odhlásit
          </button>
        </div>

        {/* Greeting */}
        <div style={{ position: 'relative', paddingBottom: 28 }}>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em',
            color: 'var(--accent)', margin: '0 0 8px', textTransform: 'uppercase',
            opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(8px)',
            transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            Vítej zpět
          </p>
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 9vw, 52px)',
            color: 'var(--paper-50)', margin: '0 0 20px',
            letterSpacing: '-0.02em', lineHeight: 1,
            opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(12px)',
            transition: 'all 0.45s 0.06s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            {name}
          </h1>

          {/* Stats */}
          <div style={{
            display: 'flex', gap: 8,
            opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(8px)',
            transition: 'all 0.45s 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            <StatBadge value={String(games)} label="her"/>
            <StatBadge value={score} label="bodů" accent/>
          </div>
        </div>
      </div>

      {/* ── Spodní část — světlá ── */}
      <div style={{
        flex: 1,
        background: 'var(--paper-200)',
        borderRadius: '22px 22px 0 0',
        padding: '20px 16px',
        paddingBottom: 'max(20px, calc(var(--safe-bottom) + 16px))',
        display: 'flex', flexDirection: 'column', gap: 10,
        opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(24px)',
        transition: 'all 0.45s 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>

        {/* Hrát */}
        <PlayCard onClick={() => navigate('/game')}/>

        {/* Sekundární */}
        <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1fr 1fr' : '1fr 1fr', gap: 10 }}>
          <SmallCard icon="👤" title="Účet" sub="Profil & statistiky" onClick={() => navigate('/account')}/>
          {isAdmin && (
            <SmallCard icon="⚙️" title="Admin" sub="Správa událostí" onClick={() => navigate('/admin')} accent/>
          )}
          <SmallCard icon="🏆" title="Skóre" sub={`${games} her · max 50 000`} onClick={() => navigate('/account')}/>
        </div>

        <p style={{
          textAlign: 'center', fontFamily: 'var(--font-serif)',
          fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, margin: '4px 0 0',
        }}>
          "Kdo nezná historii, je odsouzen ji znovu prožívat."
          <br/>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em' }}>— George Santayana</span>
        </p>
      </div>
    </div>
  )
}

function PlayCard({ onClick }: { onClick: () => void }) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      onClick={onClick}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '20px 20px',
        background: 'var(--sepia-900)',
        border: 'none', borderRadius: 18,
        cursor: 'pointer', textAlign: 'left', width: '100%',
        boxShadow: pressed ? '0 2px 8px rgba(42,31,23,0.15)' : '0 6px 28px rgba(42,31,23,0.22)',
        transform: pressed ? 'scale(0.98)' : 'scale(1)',
        transition: 'all 140ms cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: -30, right: -30,
        width: 120, height: 120, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(217,119,87,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }}/>
      <div style={{
        width: 52, height: 52, borderRadius: 14, flexShrink: 0,
        background: 'rgba(217,119,87,0.12)',
        border: '1px solid rgba(217,119,87,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
      }}>
        🌍
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'rgba(217,119,87,0.65)', marginBottom: 4, textTransform: 'uppercase' }}>
          Klasický mód · 5 kol
        </div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--paper-50)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4 }}>
          Hrát
        </div>
        <div style={{ fontSize: 13, color: 'rgba(245,241,232,0.4)' }}>
          360° panoramy · tip místa + roku
        </div>
      </div>
      <div style={{
        width: 38, height: 38, borderRadius: 11, flexShrink: 0,
        background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, color: '#fff',
        boxShadow: '0 3px 12px rgba(217,119,87,0.35)',
      }}>→</div>
    </button>
  )
}

function SmallCard({ icon, title, sub, onClick, accent }: {
  icon: string; title: string; sub: string; onClick: () => void; accent?: boolean
}) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      onClick={onClick}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        gap: 10, padding: '16px 14px',
        background: accent ? 'var(--sepia-800)' : 'var(--surface)',
        border: `1px solid ${accent ? 'rgba(255,255,255,0.06)' : 'var(--line)'}`,
        borderRadius: 16, cursor: 'pointer', textAlign: 'left', width: '100%',
        boxShadow: pressed ? 'none' : 'var(--shadow-sm)',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'all 140ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: accent ? 'rgba(255,255,255,0.07)' : 'var(--paper-200)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>{icon}</div>
      <div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, letterSpacing: '-0.01em', color: accent ? 'var(--paper-100)' : 'var(--ink)', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 11, color: accent ? 'rgba(245,241,232,0.4)' : 'var(--ink-3)' }}>{sub}</div>
      </div>
    </button>
  )
}

function StatBadge({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 5,
      background: accent ? 'rgba(217,119,87,0.10)' : 'rgba(255,255,255,0.06)',
      border: `1px solid ${accent ? 'rgba(217,119,87,0.18)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 999, padding: '6px 14px',
    }}>
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: accent ? 'var(--accent-soft)' : 'var(--paper-200)', letterSpacing: '-0.02em' }}>{value}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'rgba(245,241,232,0.35)', textTransform: 'uppercase' }}>{label}</span>
    </div>
  )
}

function Wordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="14" stroke="#f5f1e8" strokeWidth="1.5"/>
        <path d="M16 2 V30" stroke="#f5f1e8" strokeWidth="0.8" opacity="0.4"/>
        <path d="M2 16 H30" stroke="#f5f1e8" strokeWidth="0.8" opacity="0.4"/>
        <path d="M16 2 C8 8 8 24 16 30" stroke="#f5f1e8" strokeWidth="0.8" opacity="0.4" fill="none"/>
        <path d="M16 2 C24 8 24 24 16 30" stroke="#f5f1e8" strokeWidth="0.8" opacity="0.4" fill="none"/>
        <circle cx="16" cy="16" r="2.5" fill="#f5f1e8"/>
      </svg>
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, letterSpacing: '-0.01em', color: 'rgba(245,241,232,0.75)' }}>
        HistoryGuessr
      </span>
    </div>
  )
}
