import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { signOut, getTodayDailyResult, type DailyResult } from '@/lib/supabase'
import { levelFromXp, type LevelInfo } from '@/lib/leveling'
import ThemeToggle from '@/components/ThemeToggle'

type DailyState = 'loading' | 'new' | 'done'

export default function MenuPage() {
  const { user, profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)

  // ── Stav denní výzvy ──────────────────────────────────
  const [dailyState, setDailyState] = useState<DailyState>('loading')
  const [dailyResult, setDailyResult] = useState<DailyResult | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    const h = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', h)
    return () => { clearTimeout(t); window.removeEventListener('resize', h) }
  }, [])

  useEffect(() => {
    if (!user?.id) return
    let alive = true
    getTodayDailyResult(user.id).then(res => {
      if (!alive) return
      setDailyResult(res)
      setDailyState(res ? 'done' : 'new')
    }).catch(() => { if (alive) setDailyState('new') })
    return () => { alive = false }
  }, [user?.id])

  async function handleSignOut() {
    await signOut()
    navigate('/auth')
  }

  const games = profile?.games_played ?? 0
  const score = profile?.total_score?.toLocaleString('cs-CZ') ?? '0'
  const name = profile?.username ?? 'Hráči'
  const isMobile = windowWidth < 768
  const lvl = levelFromXp(profile?.xp ?? 0)

  // Podtitul + stav pro denní výzvu
  const dailySub =
    dailyState === 'done'
      ? `Skóre ${dailyResult?.score?.toLocaleString('cs-CZ') ?? 0} · vrať se zítra`
      : 'Denní výzva tě dnes ještě čeká'

  // ═══════════════════════════════════════════════════════
  // DESKTOP — filmový hero
  // ═══════════════════════════════════════════════════════
  if (!isMobile) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--feature-bg)', position: 'relative', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{ position: 'relative', zIndex: 2, padding: '18px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--feature-chip)' }}>
          <Wordmark/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThemeToggle variant="dark"/>
            <button onClick={handleSignOut} style={logoutDark}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--feature-line)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--feature-chip)')}>
              Odhlásit
            </button>
          </div>
        </header>

        <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 40px 56px' }}>
          {/* ── Filmový hero ── */}
          <div style={{
            position: 'relative', borderRadius: 22, overflow: 'hidden',
            border: '1px solid var(--feature-chip)', marginBottom: 16,
            opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(18px)',
            transition: 'all 0.55s cubic-bezier(0.16,1,0.3,1)',
          }}>
            <HeroBackdrop height={320}/>
            <div style={{ position: 'relative', height: 320, display: 'flex', alignItems: 'flex-end', padding: '0 38px 34px' }}>
              <div style={{ flex: 1 }}>
                <span style={heroTag}>Klasický mód · 5 kol</span>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 50, color: 'var(--feature-fg)', margin: '14px 0 0', letterSpacing: '-0.025em', lineHeight: 0.98 }}>
                  Začni novou výpravu
                </h1>
                <p style={{ fontSize: 15, color: 'var(--feature-fg2)', margin: '12px 0 0' }}>
                  360° panoramy · tipni místo + rok
                </p>
              </div>
              <button onClick={() => navigate('/play')} style={heroPlayBtn}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
                Hrát
                <span style={heroPlayArrow}>→</span>
              </button>
            </div>
          </div>

          {/* ── Greeting strip ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 6px 14px',
            opacity: mounted ? 1 : 0, transition: 'all 0.5s 0.08s cubic-bezier(0.16,1,0.3,1)',
          }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--feature-fg)' }}>Vítej zpět, {name}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <StatBadge value={String(games)} label="her"/>
              <StatBadge value={score} label="bodů" accent/>
            </div>
          </div>

          {/* ── Level + XP ── */}
          <div style={{ padding: '0 6px 18px', opacity: mounted ? 1 : 0, transition: 'all 0.5s 0.1s cubic-bezier(0.16,1,0.3,1)' }}>
            <LevelBar lvl={lvl} dark/>
          </div>

          {/* ── Režimy ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
            opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(16px)',
            transition: 'all 0.5s 0.14s cubic-bezier(0.16,1,0.3,1)',
          }}>
            <ModeTileDark icon="📅" title="Tento den" sub={dailySub} onClick={() => navigate('/daily')}
              dailyState={dailyState}/>
            <ModeTileDark icon="🎮" title="Více hráčů" sub="Zahraj s přáteli" onClick={() => navigate('/multiplayer/lobby')}/>
            <ModeTileDark icon="👤" title="Účet" sub="Profil & statistiky" onClick={() => navigate('/account')}/>
            <ModeTileDark icon="🏆" title="Skóre" sub="Statistiky a progres" onClick={() => navigate('/stats')}/>
            {isAdmin && <ModeTileDark icon="⚙️" title="Admin" sub="Správa událostí" onClick={() => navigate('/admin')}/>}
          </div>

          <p style={{ textAlign: 'center', fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--feature-fg3)', lineHeight: 1.6, marginTop: 40 }}>
            "Kdo nezná historii, je odsouzen ji znovu prožívat." — <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>George Santayana</span>
          </p>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════
  // MOBIL — světlý editoriál
  // ═══════════════════════════════════════════════════════
  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--paper-100)',
      display: 'flex', flexDirection: 'column',
      paddingTop: 'var(--safe-top)',
      paddingBottom: 'max(16px, var(--safe-bottom))',
    }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 0' }}>
        <Wordmark dark/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThemeToggle variant="light"/>
          <button onClick={handleSignOut} style={logoutLight}>Odhlásit</button>
        </div>
      </div>

      {/* Hlavička */}
      <div style={{
        padding: '26px 22px 18px',
        opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(12px)',
        transition: 'all 0.45s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', color: 'var(--accent-deep)', textTransform: 'uppercase', margin: 0 }}>Vítej zpět</p>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(34px, 11vw, 46px)', color: 'var(--ink)', letterSpacing: '-0.025em', lineHeight: 1, margin: '10px 0 18px' }}>{name}</h1>
        <div style={{ display: 'flex', gap: 26, marginBottom: 18 }}>
          <MobileStat value={String(games)} label="odehraných her"/>
          <MobileStat value={score} label="celkem bodů"/>
        </div>
        <LevelBar lvl={lvl}/>
      </div>

      {/* Upoutávka na hru */}
      <button onClick={() => navigate('/play')} style={{
        position: 'relative', margin: '4px 22px 18px', borderRadius: 20, overflow: 'hidden',
        border: 'none', height: 162, display: 'flex', alignItems: 'flex-end', cursor: 'pointer',
        boxShadow: 'var(--shadow-lg)', textAlign: 'left',
        opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(14px)',
        transition: 'all 0.45s 0.06s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <HeroBackdrop height={162} sideFade/>
        <div style={{ position: 'relative', padding: '18px 20px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', color: 'var(--accent-soft)', textTransform: 'uppercase' }}>Klasický mód · 5 kol</span>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 27, color: 'var(--feature-fg)', lineHeight: 1.04, marginTop: 8 }}>Hrát klasickou hru</div>
        </div>
        <div style={{
          position: 'absolute', right: 18, bottom: 18, width: 46, height: 46, borderRadius: 13,
          background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, boxShadow: '0 8px 22px rgba(217,119,87,0.45)',
        }}>→</div>
      </button>

      {/* Seznam režimů */}
      <div style={{
        margin: '0 14px', padding: '2px 8px', background: 'var(--surface)', borderRadius: 18,
        border: '1px solid var(--line)', boxShadow: 'var(--shadow-sm)',
        opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(16px)',
        transition: 'all 0.45s 0.12s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <ListItem icon="📅" title="Tento den v historii" sub={dailySub}
          onClick={() => navigate('/daily')} dailyState={dailyState}/>
        <ListItem icon="🎮" title="Více hráčů" sub="Zahraj si s přáteli" onClick={() => navigate('/multiplayer/lobby')}/>
        <ListItem icon="🏆" title="Skóre & progres" sub="Tvoje statistiky" onClick={() => navigate('/stats')}/>
        {isAdmin && <ListItem icon="⚙️" title="Admin" sub="Správa událostí" onClick={() => navigate('/admin')}/>}
      </div>

      <p style={{ textAlign: 'center', fontFamily: 'var(--font-serif)', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, margin: '20px 24px 8px' }}>
        "Kdo nezná historii, je odsouzen ji znovu prožívat."
        <br/><span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em' }}>— George Santayana</span>
      </p>
    </div>
  )
}

// ─── Dekorativní pozadí hero (panorama-like) ──────────────
function HeroBackdrop({ height, sideFade }: { height: number; sideFade?: boolean }) {
  return (
    <div style={{ position: 'absolute', inset: 0, height, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* tématický „panorama" podklad */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, var(--feature-2) 0%, var(--feature-bg) 100%)',
      }}/>
      {/* jemné diagonální linky evokující panorama */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.10,
        backgroundImage: 'repeating-linear-gradient(118deg, var(--feature-fg) 0 1px, transparent 1px 28px)',
      }}/>
      {/* jemné zjemnění kvůli čitelnosti textu */}
      <div style={{
        position: 'absolute', inset: 0,
        background: sideFade
          ? 'linear-gradient(90deg, var(--feature-bg) 0%, transparent 72%)'
          : 'linear-gradient(180deg, transparent 40%, var(--feature-bg) 100%)',
      }}/>
      <div style={{
        position: 'absolute', top: '-22%', right: '-6%', width: 360, height: 360, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(217,119,87,0.16) 0%, transparent 70%)',
      }}/>
    </div>
  )
}

// ─── Štítek denní výzvy ───────────────────────────────────
function DailyBadge({ state, floating }: { state: DailyState; floating?: boolean }) {
  if (state === 'loading') return null
  const done = state === 'done'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.07em', textTransform: 'uppercase',
      padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
      background: done ? 'var(--success-soft)' : 'var(--accent)',
      color: done ? 'var(--success-deep)' : '#fff',
      ...(floating ? { position: 'absolute', top: 11, right: 11 } : {}),
      animation: done ? 'none' : 'glow 2s infinite',
    }}>
      {done
        ? <>✓ Hotovo</>
        : <><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}/>Nová výzva</>}
    </span>
  )
}

// ─── Desktop dlaždice režimu ──────────────────────────────
function ModeTileDark({ icon, title, sub, onClick, dailyState }: {
  icon: string; title: string; sub: string; onClick: () => void; dailyState?: DailyState
}) {
  const [pressed, setPressed] = useState(false)
  const active = dailyState === 'new'
  const done = dailyState === 'done'
  return (
    <button onClick={onClick}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
      style={{
        position: 'relative', textAlign: 'left', cursor: 'pointer', width: '100%',
        background: active ? 'rgba(217,119,87,0.07)' : done ? 'rgba(92,148,104,0.07)' : 'var(--feature-chip)',
        border: `1px solid ${active ? 'rgba(217,119,87,0.35)' : done ? 'rgba(92,148,104,0.3)' : 'var(--feature-line)'}`,
        borderRadius: 14, padding: '16px 14px',
        transform: pressed ? 'scale(0.98)' : 'scale(1)', transition: 'all 140ms cubic-bezier(0.16,1,0.3,1)',
      }}>
      {dailyState && <DailyBadge state={dailyState} floating/>}
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--feature-fg)', marginTop: 18 }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--feature-fg2)', marginTop: 2 }}>{sub}</div>
    </button>
  )
}

// ─── Mobil položka seznamu ────────────────────────────────
function ListItem({ icon, title, sub, onClick, dailyState }: {
  icon: string; title: string; sub: string; onClick: () => void; dailyState?: DailyState
}) {
  const [pressed, setPressed] = useState(false)
  const active = dailyState === 'new'
  const done = dailyState === 'done'
  return (
    <button onClick={onClick}
      onTouchStart={() => setPressed(true)} onTouchEnd={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
        padding: '16px 12px', background: pressed ? 'var(--paper-200)' : 'transparent',
        border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer',
        transition: 'background 120ms',
      }}>
      <div style={{
        position: 'relative', width: 46, height: 46, borderRadius: 13, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        background: active ? 'rgba(217,119,87,0.13)' : done ? 'var(--success-soft)' : 'var(--paper-200)',
      }}>
        {icon}
        {active && <span style={{
          position: 'absolute', top: -3, right: -3, width: 13, height: 13, borderRadius: '50%',
          background: 'var(--accent)', border: '2.5px solid var(--surface)', animation: 'glow 2s infinite',
        }}/>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 9 }}>
          {title}{dailyState && <DailyBadge state={dailyState}/>}
        </div>
        <div style={{ fontSize: 12, marginTop: 2, color: active ? 'var(--accent-deep)' : done ? 'var(--success-deep)' : 'var(--ink-3)', fontWeight: active || done ? 500 : 400 }}>{sub}</div>
      </div>
      <div style={{ color: 'var(--paper-400)', fontSize: 20, flexShrink: 0 }}>›</div>
    </button>
  )
}

// ─── Drobné komponenty ────────────────────────────────────
function LevelBar({ lvl, dark }: { lvl: LevelInfo; dark?: boolean }) {
  const into = lvl.into.toLocaleString('cs-CZ')
  const need = lvl.need.toLocaleString('cs-CZ')
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: dark ? 'var(--paper-50)' : 'var(--ink)' }}>
          Level {lvl.level}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: dark ? 'var(--feature-fg2)' : 'var(--ink-3)' }}>
          {into} / {need} XP
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 999, overflow: 'hidden', background: dark ? 'var(--feature-line)' : 'var(--paper-300)' }}>
        <div style={{ height: '100%', width: `${Math.round(lvl.pct * 100)}%`, background: 'linear-gradient(90deg, #d97757, #e89a82)', borderRadius: 999, transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)' }}/>
      </div>
    </div>
  )
}

function StatBadge({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 5,
      background: accent ? 'rgba(217,119,87,0.10)' : 'var(--feature-chip)',
      border: `1px solid ${accent ? 'rgba(217,119,87,0.18)' : 'var(--feature-line)'}`,
      borderRadius: 999, padding: '6px 13px',
    }}>
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: accent ? 'var(--accent-soft)' : 'var(--paper-200)', letterSpacing: '-0.02em' }}>{value}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--feature-fg3)', textTransform: 'uppercase' }}>{label}</span>
    </div>
  )
}

function MobileStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--ink-3)', textTransform: 'uppercase', marginTop: 3 }}>{label}</div>
    </div>
  )
}

function Wordmark({ dark }: { dark?: boolean }) {
  // dark = umístěno na běžné (flipující) ploše → var(--ink); jinak na feature ploše
  const stroke = dark ? 'var(--ink)' : 'var(--feature-fg)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="14" stroke={stroke} strokeWidth="1.5"/>
        <path d="M16 2 V30" stroke={stroke} strokeWidth="0.8" opacity="0.4"/>
        <path d="M2 16 H30" stroke={stroke} strokeWidth="0.8" opacity="0.4"/>
        <path d="M16 2 C8 8 8 24 16 30" stroke={stroke} strokeWidth="0.8" opacity="0.4" fill="none"/>
        <path d="M16 2 C24 8 24 24 16 30" stroke={stroke} strokeWidth="0.8" opacity="0.4" fill="none"/>
        <circle cx="16" cy="16" r="2.5" fill={stroke}/>
      </svg>
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, letterSpacing: '-0.01em', color: dark ? 'var(--ink-2)' : 'var(--feature-fg2)' }}>
        HistoryGuessr
      </span>
    </div>
  )
}

// ─── Sdílené styly ────────────────────────────────────────
const logoutDark: React.CSSProperties = {
  background: 'var(--feature-chip)', border: '1px solid var(--feature-line)',
  borderRadius: 8, padding: '8px 16px', fontSize: 13, color: 'var(--feature-fg2)',
  cursor: 'pointer', transition: 'all 160ms',
}
const logoutLight: React.CSSProperties = {
  background: 'rgba(42,31,23,0.05)', border: '1px solid var(--line)',
  borderRadius: 8, padding: '7px 13px', fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer',
}
const heroTag: React.CSSProperties = {
  display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em',
  textTransform: 'uppercase', color: 'var(--accent-soft)', background: 'rgba(217,119,87,0.16)',
  border: '1px solid rgba(217,119,87,0.3)', padding: '5px 11px', borderRadius: 999,
}
const heroPlayBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 14,
  padding: '14px 22px 14px 24px', fontFamily: 'var(--font-serif)', fontSize: 18,
  cursor: 'pointer', boxShadow: '0 10px 30px rgba(217,119,87,0.45)', transition: 'transform 160ms',
}
const heroPlayArrow: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.22)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
}
