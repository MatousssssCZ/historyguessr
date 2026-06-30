import { useState, useEffect } from 'react'
import { currentLocale } from '@/i18n'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { signOut, getTodayDailyResult, getUserDailyResults, getEventImages, transformedImageUrl, getFriendRequests, type DailyResult } from '@/lib/supabase'
import { levelFromXp, type LevelInfo } from '@/lib/leveling'
import { useTranslation } from 'react-i18next'
import ThemeToggle from '@/components/ThemeToggle'
import LanguageSwitcher from '@/components/LanguageSwitcher'

type DailyState = 'loading' | 'new' | 'done'

export default function MenuPage() {
  const { t } = useTranslation()
  const { user, profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)

  // ── Stav denní výzvy ──────────────────────────────────
  const [dailyState, setDailyState] = useState<DailyState>('loading')
  const [dailyResult, setDailyResult] = useState<DailyResult | null>(null)
  const [dailyDays, setDailyDays] = useState<boolean[]>([])
  const [countdown, setCountdown] = useState('')
  const [friendReqs, setFriendReqs] = useState(0)

  // ── Slideshow obrázků na hero dlaždici (Ken Burns + prolínání) ──
  const [heroImgs, setHeroImgs] = useState<string[]>([])

  useEffect(() => {
    let alive = true
    const toShow = (urls: string[]) => urls.map(u => transformedImageUrl(u, { width: 1400, quality: 60 }))

    // 1) Session cache — stejná sada napříč navigací = cache hit prohlížeče.
    try {
      const cached = sessionStorage.getItem('heroImgs')
      if (cached) {
        const urls = JSON.parse(cached) as string[]
        if (Array.isArray(urls) && urls.length) { setHeroImgs(toShow(urls)); return }
      }
    } catch { /* ignore */ }

    // 2) Vyber až 5 náhodných a zapamatuj na session.
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
    // Posledních 7 dní: odehráno (✓) / vynecháno (✕) — pro streak na dlaždici
    getUserDailyResults(user.id).then(rows => {
      if (!alive) return
      const played = new Set(rows.map(r => r.date))
      const days: boolean[] = []
      const d = new Date()
      for (let i = 6; i >= 0; i--) {
        const dd = new Date(d); dd.setDate(d.getDate() - i)
        days.push(played.has(dd.toISOString().split('T')[0]))
      }
      setDailyDays(days)
    }).catch(() => {})
    getFriendRequests().then(reqs => { if (alive) setFriendReqs(reqs.length) }).catch(() => {})
    return () => { alive = false }
  }, [user?.id])

  async function handleSignOut() {
    await signOut()
    navigate('/auth')
  }

  const name = profile?.username ?? 'Hráči'
  const isMobile = windowWidth < 768
  const lvl = levelFromXp(profile?.xp ?? 0)

  // Na slideshow obrázcích držíme bílý text + tmavý scrim (jas se mezi obrázky mění)
  const onHeroImg = heroImgs.length > 0
  const heroFg = onHeroImg ? '#ffffff' : 'var(--feature-fg)'
  const heroScrimDark = onHeroImg

  // Odpočet do další výzvy (do půlnoci) — tiká jen když už je dnešní odehraná
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

  // Podtitul + stav pro denní výzvu
  const dailySub =
    dailyState === 'done'
      ? t('menu.dailyNext', { time: countdown || '00:00:00' })
      : t('menu.dailyWaiting')

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
            <LanguageSwitcher variant="dark"/>
            <ThemeToggle variant="dark"/>
            <button onClick={handleSignOut} style={logoutDark}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--feature-line)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--feature-chip)')}>
              {t('common.logout')}
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
            {onHeroImg ? <HeroSlideshow urls={heroImgs} scrimDark={heroScrimDark}/> : <HeroBackdrop height={320}/>}
            <div style={{ position: 'relative', height: 320, display: 'flex', alignItems: 'flex-end', padding: '0 38px 34px' }}>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 50, color: heroFg, margin: 0, letterSpacing: '-0.025em', lineHeight: 0.98, textShadow: onHeroImg ? '0 2px 18px rgba(0,0,0,0.35)' : 'none' }}>
                  {t('menu.heroTitle')}
                </h1>
                <p style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 0', color: '#f5ce8b', fontFamily: 'var(--font-serif)', fontSize: 18, textShadow: onHeroImg ? '0 1px 10px rgba(0,0,0,0.45)' : 'none' }}>
                  <OliveSprig/>{t('menu.heroTagline')}<OliveSprig flip/>
                </p>
              </div>
              <button onClick={() => navigate('/play')} style={heroPlayBtn}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
                {t('common.play')}
                <span style={heroPlayArrow}>→</span>
              </button>
            </div>
          </div>

          {/* ── Greeting strip ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 6px 14px',
            opacity: mounted ? 1 : 0, transition: 'all 0.5s 0.08s cubic-bezier(0.16,1,0.3,1)',
          }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--feature-fg)' }}>{t('menu.greeting', { name })}</div>
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
            <ModeTileDark icon="📅" title={t('menu.daily')} sub={dailySub} onClick={() => navigate('/daily')}
              dailyState={dailyState} streak={dailyDays}/>
            <ModeTileDark icon="🎮" title={t('menu.multiplayer')} sub={t('menu.multiplayerSub')} onClick={() => navigate('/multiplayer/lobby')}/>
            <ModeTileDark icon="👤" title={t('menu.accountTitle')} sub={t('menu.accountSub')} onClick={() => navigate('/account')}/>
            <ModeTileDark icon="🏆" title={t('menu.scoreTitle')} sub={t('menu.scoreSub')} onClick={() => navigate('/stats')}/>
            <ModeTileDark icon="👥" title={t('menu.friendsTitle')} sub={t('menu.friendsSub')} onClick={() => navigate('/friends')} badge={friendReqs}/>
            {isAdmin && <ModeTileDark icon="⚙️" title={t('menu.admin')} sub={t('menu.adminSub')} onClick={() => navigate('/admin')}/>}
          </div>

          <p style={{ textAlign: 'center', fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--feature-fg3)', lineHeight: 1.6, marginTop: 40 }}>
            {t('menu.quote')} <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{t('menu.quoteAuthor')}</span>
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
          <LanguageSwitcher/>
          <ThemeToggle variant="light"/>
          <button onClick={handleSignOut} style={logoutLight}>{t('common.logout')}</button>
        </div>
      </div>

      {/* Hlavička */}
      <div style={{
        padding: '26px 22px 18px',
        opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(12px)',
        transition: 'all 0.45s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', color: 'var(--accent-deep)', textTransform: 'uppercase', margin: 0 }}>{t('menu.welcomeBack')}</p>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(34px, 11vw, 46px)', color: 'var(--ink)', letterSpacing: '-0.025em', lineHeight: 1, margin: '10px 0 18px' }}>{name}</h1>
        <div style={{ marginBottom: 18 }}/>
        <LevelBar lvl={lvl}/>
      </div>

      {/* Upoutávka na hru */}
      <button onClick={() => navigate('/play')} style={{
        position: 'relative', margin: '4px 22px 18px', borderRadius: 20, overflow: 'hidden',
        border: 'none', minHeight: 162, display: 'flex', alignItems: 'flex-end', cursor: 'pointer',
        boxShadow: 'var(--shadow-lg)', textAlign: 'left',
        opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(14px)',
        transition: 'all 0.45s 0.06s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {onHeroImg ? <HeroSlideshow urls={heroImgs} scrimDark={heroScrimDark}/> : <HeroBackdrop height={162} sideFade/>}
        <div style={{ position: 'relative', padding: '18px 82px 18px 20px' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 27, color: heroFg, lineHeight: 1.04, textShadow: onHeroImg ? '0 2px 14px rgba(0,0,0,0.35)' : 'none' }}>{t('menu.playCardTitle')}</div>
          <p style={{ margin: '8px 0 0', color: '#f5ce8b', fontFamily: 'var(--font-serif)', fontSize: 14, lineHeight: 1.45, textShadow: onHeroImg ? '0 1px 8px rgba(0,0,0,0.45)' : 'none' }}>
            <OliveSprig/>&nbsp;{t('menu.heroTagline')}&nbsp;<OliveSprig flip/>
          </p>
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
        <ListItem icon="📅" title={t('menu.dailyMobile')} sub={dailySub}
          onClick={() => navigate('/daily')} dailyState={dailyState} streak={dailyDays}/>
        <ListItem icon="🎮" title={t('menu.multiplayer')} sub={t('menu.multiplayerSub2')} onClick={() => navigate('/multiplayer/lobby')}/>
        <ListItem icon="🏆" title={t('menu.scoreMobile')} sub={t('menu.scoreMobileSub')} onClick={() => navigate('/stats')}/>
        <ListItem icon="👥" title={t('menu.friendsTitle')} sub={t('menu.friendsSub')} onClick={() => navigate('/friends')} badge={friendReqs}/>
        {isAdmin && <ListItem icon="⚙️" title={t('menu.admin')} sub={t('menu.adminSub')} onClick={() => navigate('/admin')}/>}
      </div>

      <p style={{ textAlign: 'center', fontFamily: 'var(--font-serif)', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6, margin: '20px 24px 8px' }}>
        {t('menu.quote')}
        <br/><span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em' }}>{t('menu.quoteAuthor')}</span>
      </p>
    </div>
  )
}

// ─── Obrázek události jako pozadí hero (+ scrim pro čitelnost) ─────
// Slideshow ilustračních obrázků: pomalý Ken Burns zoom + prolínání mezi snímky.
function HeroSlideshow({ urls, scrimDark }: { urls: string[]; scrimDark: boolean }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (urls.length < 2) return
    const t = setInterval(() => setIdx(i => (i + 1) % urls.length), 7000)
    return () => clearInterval(t)
  }, [urls.length])

  const scrim = scrimDark
    ? 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.55) 100%)'
    : 'linear-gradient(180deg, rgba(250,247,240,0.1) 0%, rgba(250,247,240,0.45) 100%)'

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {urls.map((u, i) => (
        <div key={u + i} style={{
          position: 'absolute', inset: 0,
          opacity: i === idx ? 1 : 0,
          transition: 'opacity 1600ms ease-in-out',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${u})`, backgroundSize: 'cover', backgroundPosition: 'center',
            animation: 'kenburns 22s ease-in-out infinite alternate',
            animationDelay: `${i * -5}s`,
            transformOrigin: i % 2 === 0 ? 'center 30%' : 'left center',
            willChange: 'transform',
          }}/>
        </div>
      ))}
      <div style={{ position: 'absolute', inset: 0, background: scrim }}/>
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
  const { t } = useTranslation()
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
        ? <>{t('menu.badgeDone')}</>
        : <><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}/>{t('menu.badgeNew')}</>}
    </span>
  )
}

// ─── Desktop dlaždice režimu ──────────────────────────────
function ModeTileDark({ icon, title, sub, onClick, dailyState, badge, streak }: {
  icon: string; title: string; sub: string; onClick: () => void; dailyState?: DailyState; badge?: number; streak?: boolean[]
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
      {!!badge && badge > 0 && <NotifBadge count={badge} floating/>}
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--feature-fg)', marginTop: 18 }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--feature-fg2)', marginTop: 2 }}>{sub}</div>
      {streak && streak.length > 0 && <DailyStreak days={streak} tone="dark"/>}
    </button>
  )
}

// Streak posledních dní: ✓ odehráno, ✕ vynecháno
function DailyStreak({ days, tone = 'dark' }: { days: boolean[]; tone?: 'dark' | 'light' }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
      {days.map((played, i) => (
        <span key={i} title={played ? 'Odehráno' : 'Vynecháno'} style={{
          width: 15, height: 15, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, lineHeight: 1,
          background: played ? 'var(--success, #5c9468)' : (tone === 'dark' ? 'rgba(245,241,232,0.08)' : 'var(--paper-300)'),
          color: played ? '#fff' : (tone === 'dark' ? 'var(--feature-fg2)' : 'var(--ink-3)'),
          border: played ? 'none' : `1px solid ${tone === 'dark' ? 'var(--feature-line)' : 'var(--line)'}`,
        }}>{played ? '✓' : '✕'}</span>
      ))}
    </div>
  )
}

// ─── Mobil položka seznamu ────────────────────────────────
function ListItem({ icon, title, sub, onClick, dailyState, badge, streak }: {
  icon: string; title: string; sub: string; onClick: () => void; dailyState?: DailyState; badge?: number; streak?: boolean[]
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
          {title}{dailyState && <DailyBadge state={dailyState}/>}{!!badge && badge > 0 && <NotifBadge count={badge}/>}
        </div>
        <div style={{ fontSize: 12, marginTop: 2, color: active ? 'var(--accent-deep)' : done ? 'var(--success-deep)' : 'var(--ink-3)', fontWeight: active || done ? 500 : 400 }}>{sub}</div>
        {streak && streak.length > 0 && <DailyStreak days={streak} tone="light"/>}
      </div>
      <div style={{ color: 'var(--paper-400)', fontSize: 20, flexShrink: 0 }}>›</div>
    </button>
  )
}

// Olivová ratolest (SVG) — laditelná barva přes `color`
function OliveSprig({ flip }: { flip?: boolean }) {
  return (
    <svg width="22" height="16" viewBox="0 0 28 18" fill="none"
      style={{ color: '#f5ce8b', transform: flip ? 'scaleX(-1)' : 'none', flexShrink: 0, verticalAlign: 'middle' }} aria-hidden>
      <path d="M3 14 C11 13 21 11 26 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <g fill="currentColor">
        <ellipse cx="8" cy="11.5" rx="2.6" ry="1.2" transform="rotate(-28 8 11.5)"/>
        <ellipse cx="13" cy="9.6" rx="2.6" ry="1.2" transform="rotate(-32 13 9.6)"/>
        <ellipse cx="18" cy="7.4" rx="2.6" ry="1.2" transform="rotate(-36 18 7.4)"/>
        <ellipse cx="22.5" cy="5" rx="2.4" ry="1.1" transform="rotate(-42 22.5 5)"/>
      </g>
    </svg>
  )
}

// Notifikační pilulka s počtem (stejný styl jako DailyBadge)
function NotifBadge({ count, floating }: { count: number; floating?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.07em', textTransform: 'uppercase',
      padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
      background: '#e23b3b', color: '#fff',
      ...(floating ? { position: 'absolute', top: 11, right: 11 } : {}),
    }}>{count > 9 ? '9+' : count} nové</span>
  )
}

// ─── Drobné komponenty ────────────────────────────────────
function LevelBar({ lvl, dark }: { lvl: LevelInfo; dark?: boolean }) {
  const { t } = useTranslation()
  const into = lvl.into.toLocaleString(currentLocale())
  const need = lvl.need.toLocaleString(currentLocale())
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: dark ? 'var(--feature-fg)' : 'var(--ink)' }}>
          {t('menu.level')} {lvl.level}
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
