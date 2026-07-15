import { useState, useEffect } from 'react'
import { currentLocale } from '@/i18n'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getTodayDailyResult, getUserDailyResults, getEventImages, transformedImageUrl, getFriendRequests, getWorldRank, localDateISO, type DailyResult } from '@/lib/supabase'
import { levelFromXp, type LevelInfo } from '@/lib/leveling'
import { useTranslation } from 'react-i18next'
import ThemeToggle from '@/components/ThemeToggle'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import MobileNav from '@/components/MobileNav'
import HowToPlay from '@/components/HowToPlay'

type DailyState = 'loading' | 'new' | 'done'

const ACCENT_GRAD = 'linear-gradient(150deg,#d97757,#b85a3e)'

export default function MenuPage() {
  const { t } = useTranslation()
  const { user, profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)

  const [dailyState, setDailyState] = useState<DailyState>('loading')
  const [, setDailyResult] = useState<DailyResult | null>(null)
  const [dailyStreak, setDailyStreak] = useState(0)
  const [dailyWeek, setDailyWeek] = useState<boolean[]>([])
  const [countdown, setCountdown] = useState('')
  const [friendReqs, setFriendReqs] = useState(0)
  const [world, setWorld] = useState<{ rank: number; total: number } | null>(null)
  const [rankDelta, setRankDelta] = useState(0)
  const [heroImgs, setHeroImgs] = useState<string[]>([])
  const [showHowTo, setShowHowTo] = useState(false)

  // Onboarding jen JEDNOU po prvním spuštění (příznak vázaný na účet).
  // Příznak nastavíme HNED při prvním zobrazení — takže i když hráč obrazovku
  // opustí reloadem/navigací (bez „Přeskočit"), znovu se už sám neukáže.
  // Ručně jde vždy otevřít přes „?" tlačítko.
  const onboardKey = user ? `hg_onboarded_${user.id}` : null
  useEffect(() => {
    if (!onboardKey) return
    try {
      if (!localStorage.getItem(onboardKey)) {
        localStorage.setItem(onboardKey, '1')
        setShowHowTo(true)
      }
    } catch { /* ignore */ }
  }, [onboardKey])
  const closeHowTo = () => setShowHowTo(false)

  // Slideshow obrázků (session cache → cache hit prohlížeče)
  useEffect(() => {
    let alive = true
    const toShow = (urls: string[]) => urls.map(u => transformedImageUrl(u, { width: 1400, quality: 60 }))
    try {
      const cached = sessionStorage.getItem('heroImgs')
      if (cached) {
        const urls = JSON.parse(cached) as string[]
        if (Array.isArray(urls) && urls.length) { setHeroImgs(toShow(urls)); return }
      }
    } catch { /* ignore */ }
    getEventImages().then(imgs => {
      if (!alive || imgs.length === 0) return
      const pool = [...imgs]
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]] }
      const chosen = pool.slice(0, 5)
      setHeroImgs(toShow(chosen))
      try { sessionStorage.setItem('heroImgs', JSON.stringify(chosen)) } catch { /* ignore */ }
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => {
    if (!user?.id) return
    let alive = true
    getTodayDailyResult(user.id).then(res => {
      if (!alive) return
      setDailyResult(res)
      setDailyState(res ? 'done' : 'new')
    }).catch(() => { if (alive) setDailyState('new') })
    getUserDailyResults(user.id).then(rows => {
      if (!alive) return
      const played = new Set(rows.map(r => r.date))
      let streak = 0
      const d = new Date()
      if (!played.has(localDateISO(d))) d.setDate(d.getDate() - 1)
      while (played.has(localDateISO(d))) { streak++; d.setDate(d.getDate() - 1) }
      setDailyStreak(streak)
      // ✓/✕ za posledních 7 dní, ale jen ode dne registrace (dřív hráč nemohl hrát)
      const regIso = profile?.created_at ? localDateISO(new Date(profile.created_at)) : null
      const week: boolean[] = []
      const now = new Date()
      for (let i = 6; i >= 0; i--) {
        const dd = new Date(now); dd.setDate(now.getDate() - i)
        const iso = localDateISO(dd)
        if (regIso && iso < regIso) continue
        week.push(played.has(iso))
      }
      setDailyWeek(week)
    }).catch(() => {})
    getFriendRequests().then(reqs => { if (alive) setFriendReqs(reqs.length) }).catch(() => {})
    getWorldRank().then(w => {
      if (!alive) return
      setWorld(w)
      // Týdenní posun v pořadí (baseline v localStorage; roluje se po 7 dnech)
      try {
        const raw = localStorage.getItem('hg_rank_baseline')
        const b = raw ? JSON.parse(raw) as { rank: number; ts: number } : null
        if (!b || typeof b.rank !== 'number' || Date.now() - b.ts > 7 * 864e5) {
          localStorage.setItem('hg_rank_baseline', JSON.stringify({ rank: w.rank, ts: Date.now() }))
          setRankDelta(0)
        } else {
          setRankDelta(b.rank - w.rank) // kladné = posun nahoru (menší číslo pořadí)
        }
      } catch { setRankDelta(0) }
    }).catch(() => {})
    return () => { alive = false }
  }, [user?.id, profile?.xp, profile?.created_at])

  // Odpočet do další výzvy (do půlnoci) — tiká jen když je dnešní odehraná
  useEffect(() => {
    if (dailyState !== 'done') return
    const tick = () => {
      const now = new Date()
      const mid = new Date(now); mid.setHours(24, 0, 0, 0)
      let s = Math.max(0, Math.floor((mid.getTime() - now.getTime()) / 1000))
      const hh = String(Math.floor(s / 3600)).padStart(2, '0'); s %= 3600
      const mm = String(Math.floor(s / 60)).padStart(2, '0')
      const ss = String(s % 60).padStart(2, '0')
      setCountdown(`${hh}:${mm}:${ss}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [dailyState])

  const name = profile?.username ?? 'Hráči'
  const isMobile = windowWidth < 768
  const lvl = levelFromXp(profile?.xp ?? 0)
  const games = profile?.games_played ?? 0
  const totalScore = profile?.total_score ?? 0
  const avgScore = games > 0 ? Math.round(totalScore / games) : 0

  const hour = new Date().getHours()
  const greet = t(hour < 11 ? 'menu.greetMorning' : hour < 18 ? 'menu.greetAfternoon' : 'menu.greetEvening')
  const dateStr = new Date().toLocaleDateString(currentLocale(), { weekday: 'short', day: 'numeric', month: 'long' }).toUpperCase()
  const monogram = name.trim().charAt(0).toUpperCase() || '?'

  const goQuick = () => navigate('/game', { state: { rounds: 1 } })
  const goClassic = () => navigate('/play')
  const goDaily = () => navigate('/daily')
  const goMP = () => navigate('/multiplayer/lobby')

  const dailyProps = { heroImgs, dailyState, countdown, streak: dailyStreak, week: dailyWeek, onPlay: goDaily }

  // ═══════════════════ DESKTOP ═══════════════════
  if (!isMobile) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--paper-200)', display: 'flex' }}>
        <Sidebar navigate={navigate} isAdmin={isAdmin} name={name} monogram={monogram} lvl={lvl} streak={dailyStreak}/>
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          <div style={{ maxWidth: 980, margin: '0 auto', padding: '30px 40px 48px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 26 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', color: 'var(--accent-deep)', marginBottom: 8 }}>{dateStr}</div>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--ink)', lineHeight: 1, margin: 0, letterSpacing: '-0.02em' }}>{greet}, {name}</h1>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <HelpButton onClick={() => setShowHowTo(true)}/>
                <LanguageSwitcher/>
                <ThemeToggle variant="light"/>
              </div>
            </div>

            <DailyHero {...dailyProps} tall/>

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-3)', margin: '18px 0 13px' }}>{t('menu.newGame').toUpperCase()}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
              <ModeTile icon="⚡" title={t('menu.quickGame')} sub={t('menu.quickGameSubShort')} onClick={goQuick} recommended/>
              <ModeTile icon="🎚" title={t('menu.classicGame')} sub={t('menu.classicGameSubShort')} onClick={goClassic}/>
              <ModeTile icon="🔥" title={t('menu.daily')} sub={t('menu.dailyModeSub')} onClick={goDaily}/>
              <ModeTile icon="⚔" title={t('menu.multiplayer')} sub={t('menu.multiplayerSub')} onClick={goMP}/>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <ProgressCard lvl={lvl} world={world} delta={rankDelta}/>
              <QuickLinks navigate={navigate} friendReqs={friendReqs}/>
            </div>
          </div>
        </div>
        {showHowTo && <HowToPlay onClose={closeHowTo}/>}
      </div>
    )
  }

  // ═══════════════════ MOBIL ═══════════════════
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-200)', display: 'flex', flexDirection: 'column', paddingTop: 'var(--safe-top)' }}>
      {/* Top utility */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px 0' }}>
        <Wordmark/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HelpButton onClick={() => setShowHowTo(true)}/>
          <LanguageSwitcher/>
          <ThemeToggle variant="light"/>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '10px 18px 100px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em', color: 'var(--accent-deep)', marginBottom: 5 }}>{dateStr}</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.05, margin: 0, letterSpacing: '-0.01em' }}>{greet}, {name}</h1>
          </div>
        </div>

        <DailyHero {...dailyProps}/>
        <div style={{ height: 12 }}/>
        <ProgressCard lvl={lvl} world={world} delta={rankDelta}/>
        <div style={{ height: 12 }}/>
        <button onClick={() => navigate('/friends')} style={{
          display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', cursor: 'pointer',
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '14px 15px',
        }}>
          <span style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: 'var(--paper-300)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👥</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{t('menu.friendsTitle')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{t('menu.friendsSub')}</div>
          </div>
          {friendReqs > 0 && <span style={{ background: '#e23b3b', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 7px', borderRadius: 999 }}>{friendReqs}</span>}
          <span style={{ color: 'var(--ink-3)', fontSize: 18 }}>›</span>
        </button>
      </div>

      {/* Sdílená spodní lišta */}
      <MobileNav active="home"/>
      {showHowTo && <HowToPlay onClose={closeHowTo}/>}
    </div>
  )
}

// „?" tlačítko → onboarding
function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Jak hrát?" style={{
      width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
      background: 'var(--surface)', border: '1px solid var(--line-strong)', color: 'var(--ink-2)',
      fontFamily: 'var(--font-serif)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>?</button>
  )
}

// ─── Avatar s odznakem série ──────────────────────────────
function Avatar({ monogram, streak, size }: { monogram: string; streak: number; size: number }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: 'linear-gradient(150deg,#e8dfd0,#cdbfa9)', border: '1px solid var(--line-strong)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#4a4033', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: size * 0.34,
      }}>{monogram}</div>
      {streak > 0 && (
        <div style={{
          position: 'absolute', bottom: -6, right: -8, background: 'var(--accent)', color: '#fff',
          fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 10, padding: '2px 6px', borderRadius: 20,
          display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
        }}>🔥{streak}</div>
      )}
    </div>
  )
}

// ✓/✕ za posledních 7 dní (jen ode dne registrace)
function DailyMarks({ days }: { days: boolean[] }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
      {days.map((p, i) => (
        <span key={i} title={p ? 'Odehráno' : 'Vynecháno'} style={{
          width: 15, height: 15, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, lineHeight: 1,
          background: p ? 'var(--success, #5c9468)' : 'var(--paper-300)',
          color: p ? '#fff' : 'var(--ink-3)',
          border: p ? 'none' : '1px solid var(--line)',
        }}>{p ? '✓' : '✕'}</span>
      ))}
    </div>
  )
}

// ─── Hero denní výzvy ─────────────────────────────────────
function DailyHero({ heroImgs, dailyState, countdown, streak, week, onPlay, tall }: {
  heroImgs: string[]; dailyState: DailyState; countdown: string; streak: number; week: boolean[]; onPlay: () => void; tall?: boolean
}) {
  const { t } = useTranslation()
  const done = dailyState === 'done'
  const h = tall ? 196 : 130
  return (
    <button onClick={onPlay} style={{
      display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', padding: 0,
      borderRadius: 22, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--surface)',
      boxShadow: '0 8px 24px -14px rgba(60,45,30,0.3)',
    }}>
      <div style={{ position: 'relative', height: h, background: 'linear-gradient(180deg,#CBBAA0 0%,#7A6650 66%,#40331f 100%)' }}>
        {heroImgs.length > 0 && <HeroSlideshow urls={heroImgs} scrimDark/>}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(130% 100% at 40% 12%, transparent 26%, rgba(0,0,0,0.72))' }}/>
        {/* label */}
        <div style={{ position: 'absolute', top: 13, left: 15, display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.1em', color: '#fff' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f5ce8b', boxShadow: '0 0 10px #f5ce8b', animation: 'glow 2s infinite' }}/>
          {t('menu.dailyLabel').toUpperCase()}
        </div>
        {/* jen NOVÁ pro neodehrané; odpočet je v patičce (žádný duplicitní horní) */}
        {!done && (
          <div style={{ position: 'absolute', top: 12, right: 13 }}>
            <span style={{ background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', padding: '4px 9px', borderRadius: 20 }}>{t('menu.badgeNew')}</span>
          </div>
        )}
        {/* title */}
        <div style={{ position: 'absolute', left: 15, right: 15, bottom: 12, color: '#fff', fontFamily: 'var(--font-serif)', fontSize: tall ? 26 : 18, lineHeight: 1.12, textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
          {t('menu.dailyHeroTitle')}
        </div>
      </div>
      <div style={{ padding: '12px 14px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span style={{ fontSize: 22 }}>🔥</span>
          <div style={{ lineHeight: 1.18, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{t('menu.streakDays', { n: streak })}</div>
            {week.length > 0
              ? <DailyMarks days={week}/>
              : <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>{done ? t('menu.dailyNext', { time: countdown || '00:00:00' }) : t('menu.dontMissToday')}</div>}
          </div>
        </div>
        {done
          ? <span style={{ background: 'rgba(92,148,104,0.18)', color: 'var(--success-deep, #3f7a4d)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, padding: '11px 16px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>{t('menu.results')} →</span>
          : <span style={{ background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, padding: '11px 16px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>{t('menu.playChallenge')} →</span>}
      </div>
    </button>
  )
}

// ─── Progres karta (Level + XP + světový žebříček) ────────
function ProgressCard({ lvl, world, delta }: { lvl: LevelInfo; world: { rank: number; total: number } | null; delta: number }) {
  const { t } = useTranslation()
  const loc = currentLocale()
  const up = delta > 0, down = delta < 0
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{t('menu.level')} {lvl.level}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>{lvl.into.toLocaleString(loc)} / {lvl.need.toLocaleString(loc)} XP</span>
      </div>
      <div style={{ height: 8, borderRadius: 10, background: 'var(--paper-300)', overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ height: '100%', width: `${Math.round(lvl.pct * 100)}%`, background: 'linear-gradient(90deg,#d97757,#d89a54)', transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)' }}/>
      </div>
      {/* Světový žebříček — využívá uvolněné místo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: 'var(--paper-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🌍</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>{t('menu.worldRank')}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--accent)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
              {world ? `#${world.rank.toLocaleString(loc)}` : '—'}
            </span>
            {world && (up || down) && (
              <span title={t('menu.rankPeriod')} style={{
                alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 2,
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
                background: up ? 'rgba(92,148,104,0.16)' : 'rgba(192,57,43,0.14)',
                color: up ? 'var(--success-deep, #3f7a4d)' : '#c0392b',
              }}>{up ? '▲' : '▼'} {Math.abs(delta).toLocaleString(loc)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Dlaždice režimu (desktop / sheet řádek) ──────────────
function ModeTile({ icon, title, sub, onClick, recommended }: { icon: string; title: string; sub: string; onClick: () => void; recommended?: boolean }) {
  const { t } = useTranslation()
  return (
    <button onClick={onClick} style={{
      textAlign: 'left', cursor: 'pointer', width: '100%',
      background: recommended ? 'rgba(217,119,87,0.08)' : 'var(--paper-100)',
      border: `1px solid ${recommended ? 'var(--accent)' : 'var(--line)'}`,
      borderRadius: 16, padding: 15,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, background: recommended ? ACCENT_GRAD : 'var(--paper-300)', color: recommended ? '#fff' : 'var(--accent)' }}>{icon}</div>
        {recommended && <span style={{ background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 8, padding: '2px 6px', borderRadius: 20 }}>{t('menu.recommended').toUpperCase()}</span>}
      </div>
      <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{title}</div>
      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 3 }}>{sub}</div>
    </button>
  )
}

// ─── Rychlé odkazy (desktop pravý sloupec) ────────────────
function QuickLinks({ navigate, friendReqs }: { navigate: ReturnType<typeof useNavigate>; friendReqs: number }) {
  const { t } = useTranslation()
  const items: { icon: string; label: string; to: string; badge?: number }[] = [
    { icon: '🏛', label: t('menu.campaigns'), to: '/campaigns' },
    { icon: '🏅', label: t('menu.navBadges'), to: '/stats' },
    { icon: '👥', label: t('menu.friendsTitle'), to: '/friends', badge: friendReqs },
    { icon: '👤', label: t('menu.navProfile'), to: '/account' },
  ]
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 8, display: 'flex', flexDirection: 'column' }}>
      {items.map((it, i) => (
        <button key={it.to} onClick={() => navigate(it.to)} style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer',
          padding: '12px 10px', background: 'none', border: 'none', borderBottom: i < items.length - 1 ? '1px solid var(--line)' : 'none',
        }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--paper-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{it.icon}</span>
          <span style={{ flex: 1, fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 14, color: 'var(--ink)' }}>{it.label}</span>
          {!!it.badge && it.badge > 0 && <span style={{ background: '#e23b3b', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 7px', borderRadius: 999 }}>{it.badge}</span>}
          <span style={{ color: 'var(--ink-3)', fontSize: 18 }}>›</span>
        </button>
      ))}
    </div>
  )
}

// ─── Desktop sidebar ──────────────────────────────────────
function Sidebar({ navigate, isAdmin, name, monogram, lvl, streak }: {
  navigate: ReturnType<typeof useNavigate>; isAdmin: boolean; name: string; monogram: string; lvl: LevelInfo; streak: number
}) {
  const { t } = useTranslation()
  const nav: { icon: string; label: string; to: string; active?: boolean }[] = [
    { icon: '🏠', label: t('menu.navHome'), to: '/menu', active: true },
    { icon: '🏛', label: t('menu.campaigns'), to: '/campaigns' },
    { icon: '🏅', label: t('menu.navBadges'), to: '/stats' },
    { icon: '👥', label: t('menu.friendsTitle'), to: '/friends' },
    { icon: '👤', label: t('menu.navProfile'), to: '/account' },
  ]
  if (isAdmin) nav.push({ icon: '⚙️', label: t('menu.admin'), to: '/admin' })
  return (
    <div style={{ width: 234, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', padding: '22px 16px', minHeight: '100dvh' }}>
      <div style={{ padding: '0 6px', marginBottom: 26 }}><Wordmark/></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {nav.map(n => (
          <button key={n.to} onClick={() => navigate(n.to)} style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer',
            padding: '10px 12px', borderRadius: 11,
            background: n.active ? 'var(--paper-100)' : 'transparent',
            border: `1px solid ${n.active ? 'var(--line)' : 'transparent'}`,
            color: n.active ? 'var(--ink)' : 'var(--ink-2)',
            fontFamily: 'var(--font-sans)', fontWeight: n.active ? 700 : 500, fontSize: 13.5,
          }}>
            <span style={{ fontSize: 18 }}>{n.icon}</span>{n.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 11, padding: 10, borderRadius: 13, background: 'var(--paper-100)', border: '1px solid var(--line)' }}>
        <Avatar monogram={monogram} streak={0} size={36}/>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-3)', marginTop: 1 }}>LVL {lvl.level} · {t('menu.streakDays', { n: streak })}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Slideshow ilustračních obrázků (Ken Burns + prolínání) ──
function HeroSlideshow({ urls, scrimDark }: { urls: string[]; scrimDark: boolean }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (urls.length < 2) return
    const t = setInterval(() => setIdx(i => (i + 1) % urls.length), 7000)
    return () => clearInterval(t)
  }, [urls.length])
  const scrim = scrimDark
    ? 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.5) 100%)'
    : 'linear-gradient(180deg, rgba(250,247,240,0.1) 0%, rgba(250,247,240,0.45) 100%)'
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {urls.map((u, i) => (
        <div key={u + i} style={{ position: 'absolute', inset: 0, opacity: i === idx ? 1 : 0, transition: 'opacity 1600ms ease-in-out' }}>
          <div style={{
            position: 'absolute', inset: 0, backgroundImage: `url(${u})`, backgroundSize: 'cover', backgroundPosition: 'center',
            animation: 'kenburns 22s ease-in-out infinite alternate', animationDelay: `${i * -5}s`,
            transformOrigin: i % 2 === 0 ? 'center 30%' : 'left center', willChange: 'transform',
          }}/>
        </div>
      ))}
      <div style={{ position: 'absolute', inset: 0, background: scrim }}/>
    </div>
  )
}

// ─── Wordmark ─────────────────────────────────────────────
function Wordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: ACCENT_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="17" height="17" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="13" stroke="#fff" strokeWidth="1.6"/>
          <path d="M16 3 C9 9 9 23 16 29" stroke="#fff" strokeWidth="0.9" opacity="0.7" fill="none"/>
          <path d="M16 3 C23 9 23 23 16 29" stroke="#fff" strokeWidth="0.9" opacity="0.7" fill="none"/>
          <circle cx="16" cy="16" r="2.3" fill="#fff"/>
        </svg>
      </div>
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, letterSpacing: '-0.01em', color: 'var(--ink)' }}>HistoryGuessr</span>
    </div>
  )
}
