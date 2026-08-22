import { useState, useEffect } from 'react'
import { currentLocale } from '@/i18n'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getTodayDailyResult, getUserDailyResults, getEventImages, transformedImageUrl, getFriendRequests, getWorldRank, getCategoryHits, localDateISO, getMyEntitlements, type DailyResult } from '@/lib/supabase'
import { isPremiumUser } from '@/lib/entitlements'
import { levelFromXp, type LevelInfo } from '@/lib/leveling'
import { ACHIEVEMENTS, tierProgress } from '@/lib/achievements'
import { loadResume, RESUME_TTL, type ResumeState } from '@/lib/resume'
import { useTranslation } from 'react-i18next'
import ThemeToggle from '@/components/ThemeToggle'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import MobileNav from '@/components/MobileNav'
import Icon, { type IconName } from '@/components/Icon'
import HowToPlay from '@/components/HowToPlay'
import InstallGuide from '@/components/InstallGuide'
import AdSlot from '@/components/AdSlot'
import { isStandalone, isInstallTileHidden } from '@/lib/pwaInstall'
import { DownloadIcon } from '@/components/BrowserIcons'

type DailyState = 'loading' | 'new' | 'done'

// Jeden den v týdenním pruhu série (varianta A: den v týdnu + dnešek)
type DayMark = { played: boolean; label: string; isToday: boolean }

const ACCENT_GRAD = 'linear-gradient(150deg,#d97757,#b85a3e)'

// Krátkodobá in-memory cache dat menu — drží se mezi překliky v rámci session
// (nikoli po reloadu). Klíč obsahuje xp + datum registrace, takže po odehrání
// (změna xp) se data automaticky obnoví. TTL zabrání zbytečným dotazům při
// rychlém přepínání mezi obrazovkami.
interface MenuData {
  dailyResult: DailyResult | null
  dailyState: DailyState
  dailyStreak: number
  dailyWeek: DayMark[]
  friendReqs: number
  world: { rank: number; total: number } | null
  rankDelta: number
  catHits: Record<string, number>
}
let menuCache: { key: string; ts: number; data: MenuData } | null = null
const MENU_TTL = 60_000

/** Zahodí cache menu — volat po akci, která mění dashboard (dohraná daily),
 *  aby se streak / ✓ za dnešek projevily hned a ne až po vypršení TTL. */
export function invalidateMenuCache() { menuCache = null }

export default function MenuPage() {
  const { t } = useTranslation()
  const { user, profile, isAnonymous } = useAuth()
  const navigate = useNavigate()
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)

  const [dailyState, setDailyState] = useState<DailyState>('loading')
  const [, setDailyResult] = useState<DailyResult | null>(null)
  const [dailyStreak, setDailyStreak] = useState(0)
  const [dailyWeek, setDailyWeek] = useState<DayMark[]>([])
  const [countdown, setCountdown] = useState('')
  const [friendReqs, setFriendReqs] = useState(0)
  const [world, setWorld] = useState<{ rank: number; total: number } | null>(null)
  const [rankDelta, setRankDelta] = useState(0)
  const [catHits, setCatHits] = useState<Record<string, number>>({})
  const [resume, setResume] = useState<ResumeState | null>(null)
  const [heroImgs, setHeroImgs] = useState<string[]>([])
  const [showHowTo, setShowHowTo] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const [installTileHidden, setInstallTileHidden] = useState(() => isInstallTileHidden())
  const [isPremium, setIsPremium] = useState(false)
  useEffect(() => { getMyEntitlements().then(e => setIsPremium(isPremiumUser(e))).catch(() => {}) }, [])

  // „Jak hrát" se NEZOBRAZUJE automaticky — jen ručně přes „?" tlačítko
  // v menu nebo řádek „Jak hrát?" v účtu. (Auto-zobrazení bylo per-zařízení,
  // takže na novém počítači naskakovalo znovu.)
  const closeHowTo = () => setShowHowTo(false)

  // Rozehraná hra (pro „Pokračovat ve hře") — čti při každém mountu
  useEffect(() => {
    if (user?.id) setResume(loadResume(user.id))
  }, [user?.id])

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
    const key = `${user.id}:${profile?.xp ?? 0}:${profile?.created_at ?? ''}`

    // Cache hit — hydratuj stav bez dotazu na API
    const apply = (d: MenuData) => {
      setDailyResult(d.dailyResult)
      setDailyState(d.dailyState)
      setDailyStreak(d.dailyStreak)
      setDailyWeek(d.dailyWeek)
      setFriendReqs(d.friendReqs)
      setWorld(d.world)
      setRankDelta(d.rankDelta)
      setCatHits(d.catHits)
    }
    if (menuCache && menuCache.key === key && Date.now() - menuCache.ts < MENU_TTL) {
      apply(menuCache.data)
      return
    }

    let alive = true
    Promise.all([
      getTodayDailyResult(user.id).catch(() => null),
      getUserDailyResults(user.id).catch(() => [] as { date: string }[]),
      getFriendRequests().catch(() => [] as unknown[]),
      isAnonymous ? Promise.resolve(null) : getWorldRank().catch(() => null),  // žebříček jen pro registrované
      getCategoryHits(user.id).catch(() => ({} as Record<string, number>)),
    ]).then(([res, rows, reqs, w, hits]) => {
      if (!alive) return

      // Streak + ✓/✕ za posledních 7 dní (jen ode dne registrace)
      const played = new Set(rows.map(r => r.date))
      let streak = 0
      const d = new Date()
      if (!played.has(localDateISO(d))) d.setDate(d.getDate() - 1)
      while (played.has(localDateISO(d))) { streak++; d.setDate(d.getDate() - 1) }
      const regIso = profile?.created_at ? localDateISO(new Date(profile.created_at)) : null
      const week: DayMark[] = []
      const now = new Date()
      const todayIso = localDateISO(now)
      for (let i = 6; i >= 0; i--) {
        const dd = new Date(now); dd.setDate(now.getDate() - i)
        const iso = localDateISO(dd)
        if (regIso && iso < regIso) continue
        const label = dd.toLocaleDateString(currentLocale(), { weekday: 'short' }).replace('.', '')
        week.push({ played: played.has(iso), label, isToday: iso === todayIso })
      }

      // Týdenní posun v pořadí (baseline v localStorage; roluje se po 7 dnech)
      let rankDelta = 0
      if (w) {
        try {
          const raw = localStorage.getItem('hg_rank_baseline')
          const b = raw ? JSON.parse(raw) as { rank: number; ts: number } : null
          if (!b || typeof b.rank !== 'number' || Date.now() - b.ts > 7 * 864e5) {
            localStorage.setItem('hg_rank_baseline', JSON.stringify({ rank: w.rank, ts: Date.now() }))
          } else {
            rankDelta = b.rank - w.rank // kladné = posun nahoru (menší číslo pořadí)
          }
        } catch { /* ignore */ }
      }

      const data: MenuData = {
        dailyResult: res,
        dailyState: res ? 'done' : 'new',
        dailyStreak: streak,
        dailyWeek: week,
        friendReqs: reqs.length,
        world: w,
        rankDelta,
        catHits: hits,
      }
      menuCache = { key, ts: Date.now(), data }
      apply(data)
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

  const name = profile?.username ?? t('common.defaultPlayer')
  const isMobile = windowWidth < 768
  const lvl = levelFromXp(profile?.xp ?? 0)

  const hour = new Date().getHours()
  const greet = t(hour < 11 ? 'menu.greetMorning' : hour < 18 ? 'menu.greetAfternoon' : 'menu.greetEvening')
  const dateStr = new Date().toLocaleDateString(currentLocale(), { weekday: 'short', day: 'numeric', month: 'long' }).toUpperCase()

  const goQuick = () => navigate('/game', { state: { rounds: 1 } })
  const goClassic = () => navigate('/play')
  const goDaily = () => navigate('/daily')
  const goMP = () => navigate('/multiplayer/lobby')
  const goResume = () => navigate('/game', { state: { resume: true } })

  const dailyProps = { heroImgs, dailyState, countdown, streak: dailyStreak, week: dailyWeek, onPlay: goDaily }

  // Nejbližší odznak (napříč kategoriemi) — pro kartu Level na desktopu
  let nearest: { name: string; icon: string; have: number; need: number } | null = null
  for (const cat of ACHIEVEMENTS) {
    if (cat.id === 'streak') continue
    const hits = catHits[cat.id] ?? 0
    const { next } = tierProgress(cat.tiers, hits)
    if (next && (!nearest || (next.count - hits) < (nearest.need - nearest.have))) {
      nearest = { name: next.name, icon: next.icon, have: hits, need: next.count }
    }
  }

  // Poslední dlaždice: „Přidat na plochu". Zmizí, když už app běží nainstalovaná
  // nebo si ji hráč odklikl v průvodci.
  const installTile = (!isStandalone() && !installTileHidden) ? (
    <button onClick={() => setShowInstall(true)} style={{
      display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', cursor: 'pointer',
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '14px 15px',
    }}>
      <span style={{
        width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: ACCENT_GRAD,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
      }}><DownloadIcon size={21} color="#fff"/></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{t('common.instTile')}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{t('common.instTileSub')}</div>
      </div>
      <span style={{ color: 'var(--ink-3)', fontSize: 18 }}>›</span>
    </button>
  ) : null

  // ═══════════════════ DESKTOP ═══════════════════
  if (!isMobile) {
    const loc = currentLocale()
    const dot = (on: boolean) => ({ width: 7, height: 7, borderRadius: '50%', background: on ? '#E8C88A' : 'rgba(251,247,240,.28)' })
    const nav: { label: string; onClick?: () => void; href?: string; active?: boolean }[] = [
      { label: t('menu.navHome'), onClick: () => {}, active: true },
      { label: t('menu.campaigns'), onClick: () => navigate('/campaigns') },
      { label: t('menu.navBadges'), onClick: () => navigate('/stats') },
      { label: t('menu.navFriends'), onClick: () => navigate('/friends') },
      { label: t('menu.navExplore'), href: `/${loc}/${loc === 'en' ? 'explore' : loc === 'de' ? 'entdecken' : 'objevuj'}` },
    ]
    const modes: { icon: IconName; title: string; sub: string; onClick: () => void; primary?: boolean }[] = [
      { icon: 'bolt', title: t('menu.quickGame'), sub: t('menu.quickGameSubShort'), onClick: goQuick, primary: true },
      { icon: 'sliders', title: t('menu.classicGame'), sub: t('menu.classicGameSubShort'), onClick: goClassic },
      { icon: 'swords', title: t('menu.multiplayer'), sub: t('menu.multiplayerSub'), onClick: goMP },
    ]
    const GLASS = { background: 'rgba(20,16,12,.55)', backdropFilter: 'blur(18px) saturate(140%)', WebkitBackdropFilter: 'blur(18px) saturate(140%)', border: '1px solid rgba(251,247,240,.14)', borderRadius: 20 } as const
    const cardLabel = { fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'rgba(251,247,240,.5)' }
    return (
      <div style={{ position: 'relative', minHeight: '100dvh', background: '#14110D', color: '#FBF7F0', overflow: 'hidden' }}>
        {/* Panorama na pozadí */}
        <div style={{ position: 'absolute', inset: 0 }}>
          {heroImgs.length > 0
            ? <HeroSlideshow urls={heroImgs} scrimDark/>
            : <div className="skeleton" style={{ position: 'absolute', inset: 0 }}/>}
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(16,13,10,.78) 0%, rgba(16,13,10,.32) 42%, rgba(16,13,10,.93) 100%)', pointerEvents: 'none' }}/>

        {/* Obsah */}
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 1320, margin: '0 auto', padding: '0 32px', paddingTop: 'var(--safe-top)' }}>
          {/* Topbar */}
          <header style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', height: 74, gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: ACCENT_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Icon name="globe" size={17}/></span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 19, letterSpacing: '-0.01em' }}>Historyguesser</span>
            </div>
            <nav style={{ display: 'flex', gap: 3, padding: 5, background: 'rgba(24,20,15,.5)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', border: '1px solid rgba(251,247,240,.14)', borderRadius: 15 }}>
              {nav.map((n) => {
                const st: React.CSSProperties = { display: 'flex', alignItems: 'center', height: 36, padding: '0 16px', borderRadius: 11, fontFamily: 'var(--font-sans)', fontWeight: n.active ? 700 : 600, fontSize: 13, cursor: 'pointer', textDecoration: 'none', color: n.active ? '#26211C' : 'rgba(251,247,240,.75)', background: n.active ? '#FBF7F0' : 'transparent', border: 'none' }
                return n.href
                  ? <a key={n.label} href={n.href} style={st}>{n.label}</a>
                  : <button key={n.label} onClick={n.onClick} style={st}>{n.label}</button>
              })}
            </nav>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px', borderRadius: 11, background: 'rgba(251,247,240,.08)', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#E8C88A' }}>🔥 {dailyStreak}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 11, background: 'rgba(251,247,240,.08)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', color: 'rgba(251,247,240,.8)' }}>{t('menu.level').toUpperCase()} {lvl.level}</span>
              <button onClick={() => navigate('/account')} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer', background: ACCENT_GRAD, color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15 }}>{name.charAt(0).toUpperCase()}</button>
            </div>
          </header>

          {/* Hero tělo */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 372px', gap: 44, alignItems: 'end', padding: '32px 0' }}>
            {/* Levý sloupec */}
            <div style={{ maxWidth: 620 }}>
              <div style={{ ...cardLabel, color: '#E9A183', marginBottom: 16 }}><span style={{ display: 'inline-flex', width: 6, height: 6, borderRadius: '50%', background: '#BE6240', marginRight: 8, verticalAlign: 'middle' }}/>{t('menu.dailyLabel').toUpperCase()} · {dateStr}</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: 'rgba(251,247,240,.75)', marginBottom: 10 }}>{greet}, {name}</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 'clamp(40px, 4.6vw, 60px)', lineHeight: 1.05, letterSpacing: '-0.03em', margin: '0 0 28px' }}>{t('menu.heroQuestion')}</h1>
              <button onClick={goDaily} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 28px', borderRadius: 15, border: 'none', cursor: 'pointer', background: ACCENT_GRAD, color: '#FBF7F0', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16, boxShadow: '0 22px 46px -20px rgba(190,98,64,.95)' }}>
                <Icon name="bolt" size={18}/> {dailyState === 'done' ? t('menu.results') : t('menu.playChallenge')}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 26 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em', color: 'rgba(251,247,240,.7)' }}>🔥 {t('menu.streakDays', { count: dailyStreak })}</span>
                <span style={{ display: 'flex', gap: 5 }}>{(dailyWeek.length ? dailyWeek : Array.from({ length: 7 }, () => ({ played: false }))).slice(0, 7).map((d, i) => <span key={i} style={dot(d.played)}/>)}</span>
              </div>
            </div>

            {/* Pravý sloupec — karty */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, alignSelf: 'stretch', justifyContent: 'center' }}>
              {/* Nová hra */}
              <div style={{ ...GLASS, padding: 16 }}>
                <div style={{ ...cardLabel, marginBottom: 12 }}>{t('menu.newGame')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {modes.map((m) => (
                    <button key={m.title} onClick={m.onClick} style={{
                      display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', cursor: 'pointer',
                      padding: '12px 14px', borderRadius: 14,
                      background: m.primary ? 'rgba(190,98,64,.9)' : 'rgba(251,247,240,.05)',
                      border: `1px solid ${m.primary ? 'rgba(233,161,131,.5)' : 'rgba(251,247,240,.1)'}`,
                    }}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: m.primary ? 'rgba(251,247,240,.16)' : 'rgba(251,247,240,.08)', color: '#FBF7F0' }}><Icon name={m.icon} size={17}/></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, color: '#FBF7F0' }}>{m.title}</span>
                        <span style={{ display: 'block', fontSize: 11.5, color: 'rgba(251,247,240,.6)', marginTop: 1 }}>{m.sub}</span>
                      </span>
                      <span style={{ color: 'rgba(251,247,240,.5)', fontSize: 16 }}>→</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Level / XP */}
              <button onClick={() => navigate('/leaderboard')} style={{ ...GLASS, padding: 18, textAlign: 'left', cursor: 'pointer', color: '#FBF7F0' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 24, letterSpacing: '-0.02em' }}>{t('menu.level')} {lvl.level}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(251,247,240,.6)' }}>{lvl.into.toLocaleString(loc)} / {lvl.need.toLocaleString(loc)} XP</span>
                </div>
                <div style={{ height: 7, borderRadius: 999, background: 'rgba(251,247,240,.12)', overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ width: `${Math.round(lvl.pct * 100)}%`, height: '100%', background: ACCENT_GRAD, borderRadius: 999 }}/>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={cardLabel}>{t('menu.worldRank')}</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#E9A183', marginTop: 3 }}>{world ? `#${world.rank.toLocaleString(loc)}` : '—'}</div>
                  </div>
                  {nearest && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={cardLabel}>{t('menu.nearestBadges')}</div>
                      <div style={{ fontSize: 13, color: '#FBF7F0', marginTop: 5 }}>{nearest.icon} {nearest.name} <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(251,247,240,.6)' }}>{nearest.have}/{nearest.need}</span></div>
                    </div>
                  )}
                </div>
              </button>

              {/* Pokračuj v kampani */}
              <button onClick={() => navigate('/campaigns')} style={{ ...GLASS, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer', textAlign: 'left', color: '#FBF7F0' }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(251,247,240,.08)', color: '#E9A183' }}><Icon name="swords" size={19}/></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ ...cardLabel, display: 'block' }}>{t('menu.contCampaign')}</span>
                  <span style={{ display: 'block', fontFamily: 'var(--font-serif)', fontSize: 17, marginTop: 3 }}>{t('menu.campaigns')}</span>
                </span>
                <span style={{ color: 'rgba(251,247,240,.5)', fontSize: 18 }}>→</span>
              </button>
            </aside>
          </div>

          {/* Spodní pruh */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, borderTop: '1px solid rgba(251,247,240,.14)', padding: '20px 0 calc(20px + var(--safe-bottom))' }}>
            <a href={nav[4].href} style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', color: '#FBF7F0', fontFamily: 'var(--font-mono)', fontSize: 'clamp(18px, 2.2vw, 30px)', letterSpacing: '0.06em' }}>
              <span style={{ fontSize: '1.1em' }}>↓</span> {t('menu.exploreHistory').toUpperCase()}
            </a>
            <div style={{ display: 'flex', gap: 22 }}>
              <button onClick={() => setShowHowTo(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(251,247,240,.7)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13 }}>{t('menu.howShort')}</button>
              <a href={`/${loc}/${loc === 'en' ? 'about' : loc === 'de' ? 'ueber-uns' : 'o-projektu'}`} style={{ textDecoration: 'none', color: 'rgba(251,247,240,.7)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13 }}>{t('menu.aboutShort')}</a>
              <LanguageSwitcher/>
              <ThemeToggle variant="dark"/>
            </div>
          </div>
        </div>
        {showHowTo && <HowToPlay onClose={closeHowTo}/>}
        {showInstall && <InstallGuide showHideOption onClose={() => { setShowInstall(false); setInstallTileHidden(isInstallTileHidden()) }}/>}
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

      <div style={{ flex: 1, overflow: 'auto', padding: '10px 18px 0', paddingBottom: 'var(--nav-space)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em', color: 'var(--accent-deep)', marginBottom: 5 }}>{dateStr}</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.05, margin: 0, letterSpacing: '-0.01em' }}>{greet}, {name}</h1>
          </div>
        </div>

        <DailyHero {...dailyProps}/>
        <div style={{ height: 12 }}/>
        {resume && <><ResumeBar resume={resume} onResume={goResume}/><div style={{ height: 12 }}/></>}
        <ProgressCard lvl={lvl} world={world} delta={rankDelta} loading={dailyState === 'loading'} onOpen={() => navigate('/leaderboard')}/>
        <div style={{ height: 12 }}/>
        <NearestBadges catHits={catHits} navigate={navigate}/>
        <div style={{ height: 12 }}/>
        <button onClick={() => navigate('/friends')} style={{
          display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', cursor: 'pointer',
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '14px 15px',
        }}>
          <span style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: 'var(--paper-300)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="friends" size={21}/></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{t('menu.friendsTitle')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{t('menu.friendsSub')}</div>
          </div>
          {friendReqs > 0 && <span style={{ background: '#e23b3b', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 7px', borderRadius: 999 }}>{friendReqs}</span>}
          <span style={{ color: 'var(--ink-3)', fontSize: 18 }}>›</span>
        </button>

        {isPremium
          ? <><div style={{ height: 12 }}/><RoadmapTile onClick={() => navigate('/roadmap')}/></>
          : isAnonymous
            ? <><div style={{ height: 12 }}/><SaveProgressBanner onClick={() => navigate('/auth', { state: { mode: 'register' } })}/></>
            : <><div style={{ height: 12 }}/><PremiumBanner onClick={() => navigate('/premium')}/></>}

        {/* Poslední dlaždice — přidání na plochu */}
        {installTile && <><div style={{ height: 12 }}/>{installTile}</>}

        {/* Reklama (jen Free; zobrazí se až po zapnutí AdSense) */}
        <AdSlot placement="overview_screen" label={t('ads.label')} />
      </div>

      {/* Sdílená spodní lišta */}
      <MobileNav active="home"/>
      {showHowTo && <HowToPlay onClose={closeHowTo}/>}
      {showInstall && <InstallGuide showHideOption onClose={() => { setShowInstall(false); setInstallTileHidden(isInstallTileHidden()) }}/>}
    </div>
  )
}

// ─── Pokračovat ve hře (rozehraná solo hra) ───────────────
function ResumeBar({ resume, onResume }: { resume: ResumeState; onResume: () => void }) {
  const { t } = useTranslation()
  const loc = currentLocale()
  const [left, setLeft] = useState(() => Math.max(0, resume.savedAt + RESUME_TTL - Date.now()))
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, resume.savedAt + RESUME_TTL - Date.now())), 1000)
    return () => clearInterval(id)
  }, [resume.savedAt])
  if (left <= 0) return null
  const s = Math.floor(left / 1000)
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  const round = resume.rounds.length + 1

  return (
    <button onClick={onResume} style={{
      display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', cursor: 'pointer',
      background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 16, padding: '11px 14px',
    }}>
      <span style={{ width: 44, height: 44, borderRadius: 11, flexShrink: 0, overflow: 'hidden', background: 'var(--paper-300)', backgroundImage: resume.events[resume.rounds.length]?.preview_url ? `url(${resume.events[resume.rounds.length].preview_url})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{t('menu.resumeTitle')}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
            {t('menu.resumeRound', { n: round, total: resume.totalRounds })} · {resume.totalScore.toLocaleString(loc)} b.
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--accent-deep)', marginTop: 3 }}>
          ⏱ {mm}:{ss} · {t('menu.resumeWindow')}
        </div>
      </div>
      <span style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: ACCENT_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M8 5.5 L18.5 12 L8 18.5 Z"/></svg>
      </span>
    </button>
  )
}

// ─── Nejbližší odznaky (nejblíž dalšímu stupni) ───────────
function NearestBadges({ catHits, navigate }: { catHits: Record<string, number>; navigate: ReturnType<typeof useNavigate> }) {
  const { t } = useTranslation()
  const items = ACHIEVEMENTS.map(cat => {
    const hits = catHits[cat.id] ?? 0
    const { next } = tierProgress(cat.tiers, hits)
    if (!next) return null // vše odemčeno v kategorii
    return { cat, hits, next, frac: hits / next.count }
  }).filter(Boolean) as { cat: typeof ACHIEVEMENTS[number]; hits: number; next: { count: number; icon: string; name: string }; frac: number }[]

  // Nejblíž dokončení první; při shodě méně zbývajících napřed
  items.sort((a, b) => b.frac - a.frac || (a.next.count - a.hits) - (b.next.count - b.hits))
  const top = items.slice(0, 3)
  if (top.length === 0) return null

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '15px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{t('menu.nearestBadges')}</span>
        <button onClick={() => navigate('/stats')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13 }}>{t('menu.seeAll')}</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {top.map(it => {
          const active = it.hits > 0
          const pct = Math.max(0, Math.min(100, Math.round(it.frac * 100)))
          return (
            <div key={it.cat.id} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: active ? 1 : 0.55 }}>
              <span style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0, fontSize: 19,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: active ? ACCENT_GRAD : 'var(--paper-300)',
                filter: active ? 'none' : 'grayscale(1)',
              }}>{it.next.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('ach.' + it.cat.id + '.c' + it.next.count, it.next.name)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>· {it.hits}/{it.next.count}</span>
                </div>
                <div style={{ height: 5, background: 'var(--paper-200)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: ACCENT_GRAD, borderRadius: 999, transition: 'width 400ms' }}/>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Přátelé dnes (skóre za dnešek napříč režimy) ─────────
// „?" tlačítko → onboarding
function HelpButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button onClick={onClick} aria-label={t('menu.htHow')} style={{
      width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
      background: 'var(--surface)', border: '1px solid var(--line-strong)', color: 'var(--ink-2)',
      fontFamily: 'var(--font-serif)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>?</button>
  )
}

// ─── Avatar s odznakem série ──────────────────────────────

// ✓/✕ za posledních 7 dní (jen ode dne registrace)
function DailyMarks({ days }: { days: DayMark[] }) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', gap: 5, marginTop: 5, flexShrink: 0 }}>
      {days.map((d, i) => {
        const todayOpen = d.isToday && !d.played  // dnešek ještě neodehraný → šedý kruh s pomlčkou
        const title = d.played ? t('menu.markPlayed') : d.isToday ? t('menu.markToday') : t('menu.markMissed')
        return (
          <div key={i} style={{ textAlign: 'center', flexShrink: 0 }}>
            <div title={title} style={{
              width: 19, height: 19, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, lineHeight: 1,
              background: d.played ? 'var(--success)' : todayOpen ? 'var(--paper-300)' : 'var(--danger-soft)',
              color: d.played ? '#fff' : todayOpen ? 'var(--ink-3)' : 'var(--danger)',
              border: d.played ? 'none' : `1px solid ${todayOpen ? 'var(--line-strong)' : 'var(--danger)'}`,
            }}>{d.played ? '✓' : todayOpen ? '–' : '✕'}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, marginTop: 3, color: d.isToday ? 'var(--accent-deep)' : 'var(--ink-3)' }}>{d.label}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Hero denní výzvy ─────────────────────────────────────
function DailyHero({ heroImgs, dailyState, countdown, streak, week, onPlay, tall }: {
  heroImgs: string[]; dailyState: DailyState; countdown: string; streak: number; week: DayMark[]; onPlay: () => void; tall?: boolean
}) {
  const { t } = useTranslation()
  const done = dailyState === 'done'
  const h = tall ? 196 : 130
  const now = new Date()
  const weekday = now.toLocaleDateString(currentLocale(), { weekday: 'short' }).replace('.', '').toUpperCase()
  const dayNum = now.getDate()
  return (
    <button onClick={onPlay} style={{
      display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', padding: 0,
      borderRadius: 22, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--surface)',
      boxShadow: '0 8px 24px -14px rgba(60,45,30,0.3)',
    }}>
      <div style={{ position: 'relative', height: h, background: 'linear-gradient(180deg,#CBBAA0 0%,#7A6650 66%,#40331f 100%)' }}>
        {/* Dokud nedorazí obrázky, jemný shimmer místo prázdného gradientu */}
        {heroImgs.length === 0 && <div className="skeleton" style={{ position: 'absolute', inset: 0, background: 'transparent', borderRadius: 0 }}/>}
        {heroImgs.length > 0 && <HeroSlideshow urls={heroImgs} scrimDark/>}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(130% 100% at 40% 12%, transparent 26%, rgba(0,0,0,0.72))' }}/>
        {/* kalendářní lístek s dnešním datem — jasně signalizuje „denní výzva" */}
        <div style={{ position: 'absolute', top: 13, left: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 44, background: 'var(--paper-50)', borderRadius: 9, overflow: 'hidden', textAlign: 'center', boxShadow: '0 3px 10px rgba(0,0,0,0.35)', flexShrink: 0 }}>
            <div style={{ background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em', padding: '2px 0' }}>{weekday}</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', lineHeight: 1.1, padding: '1px 0 3px' }}>{dayNum}</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.13em', color: '#fff', fontWeight: 600 }}>{t('menu.dailyLabel').toUpperCase()}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>{t('menu.dailyEveryDay')}</div>
          </div>
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
          <span style={{ display: 'flex', color: 'var(--accent)' }}><Icon name="flame" size={20}/></span>
          <div style={{ lineHeight: 1.18, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{t('menu.streakDays', { n: streak })}</div>
            {week.length > 0
              ? <DailyMarks days={week}/>
              : <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>{done ? t('menu.dailyNext', { time: countdown || '00:00:00' }) : t('menu.dontMissToday')}</div>}
          </div>
        </div>
        {done
          ? <span style={{ background: 'rgba(92,148,104,0.18)', color: 'var(--success-deep, #3f7a4d)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, padding: '11px 16px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>{t('menu.results')} →</span>
          : <span style={{ background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, padding: tall ? '11px 16px' : '11px 14px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap' }}>{tall ? t('menu.playChallenge') : t('menu.playShort')} →</span>}
      </div>
    </button>
  )
}

// ─── Progres karta (Level + XP + světový žebříček) ────────
function ProgressCard({ lvl, world, delta, loading, onOpen }: { lvl: LevelInfo; world: { rank: number; total: number } | null; delta: number; loading?: boolean; onOpen?: () => void }) {
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
      {/* Světový žebříček — klikací, otevře plný žebříček */}
      <button onClick={onOpen} disabled={!onOpen} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: onOpen ? 'pointer' : 'default' }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: 'var(--paper-200)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="globe" size={22}/></div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>{t('menu.worldRank')}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minHeight: 32 }}>
            {world
              ? <span style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--accent)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>#{world.rank.toLocaleString(loc)}</span>
              : loading
                ? <span className="skeleton" style={{ display: 'inline-block', width: 74, height: 26, marginTop: 4 }}/>
                : <span style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--accent)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>—</span>}
            {world && (up || down) && (
              <span title={t('menu.rankPeriod')} style={{
                alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 2,
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
                background: up ? 'rgba(92,148,104,0.16)' : 'rgba(192,57,43,0.14)',
                color: up ? 'var(--success-deep, #3f7a4d)' : 'var(--danger)',
              }}>{up ? '▲' : '▼'} {Math.abs(delta).toLocaleString(loc)}</span>
            )}
          </div>
        </div>
        {onOpen && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12, color: 'var(--accent)' }}>
            {t('lb.viewCta')} <span style={{ fontSize: 14 }}>→</span>
          </span>
        )}
      </button>
    </div>
  )
}

// ─── CTA banner Premium (jen pro Free hráče) ──────────────
function PremiumBanner({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', cursor: 'pointer',
      background: ACCENT_GRAD, border: 'none', borderRadius: 18, padding: '14px 16px', color: '#fff',
    }}>
      <span style={{ flexShrink: 0, display: 'flex' }}><Icon name="star" size={22}/></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15 }}>{t('menu.premiumCtaTitle')}</div>
        <div style={{ fontSize: 11.5, opacity: 0.92, marginTop: 2 }}>{t('menu.premiumCtaSub')}</div>
      </div>
      <span style={{ fontSize: 18, opacity: 0.9 }}>›</span>
    </button>
  )
}

// ─── Banner pro anonyma: ulož si postup / soutěž ──────────
function SaveProgressBanner({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', cursor: 'pointer',
      background: ACCENT_GRAD, border: 'none', borderRadius: 18, padding: '14px 16px', color: '#fff',
    }}>
      <span style={{ flexShrink: 0, display: 'flex' }}><Icon name="save" size={22}/></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15 }}>{t('menu.guestSaveTitle')}</div>
        <div style={{ fontSize: 11.5, opacity: 0.92, marginTop: 2 }}>{t('menu.guestSaveSub')}</div>
      </div>
      <span style={{ fontSize: 18, opacity: 0.9 }}>›</span>
    </button>
  )
}

// ─── Dlaždice roadmapy (jen pro předplatitele) ────────────
function RoadmapTile({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', cursor: 'pointer',
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '14px 15px',
    }}>
      <span style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: 'var(--paper-300)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="roadmap" size={21}/></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{t('menu.roadmapTitle')}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{t('menu.roadmapSub')}</div>
      </div>
      <span style={{ color: 'var(--ink-3)', fontSize: 18 }}>›</span>
    </button>
  )
}

// ─── Dlaždice režimu (desktop / sheet řádek) ──────────────
// ─── Slideshow ilustračních obrázků (Ken Burns + prolínání) ──
function HeroSlideshow({ urls, scrimDark }: { urls: string[]; scrimDark: boolean }) {
  const [idx, setIdx] = useState(0)
  // Než se první obrázek dekóduje, drží se shimmer podklad; pak celý slideshow
  // plynule najede (žádné „bliknutí" přes gradient).
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!urls[0]) return
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => setReady(true)
    img.onerror = () => setReady(true)
    img.src = urls[0]
  }, [urls])
  useEffect(() => {
    if (urls.length < 2) return
    const t = setInterval(() => setIdx(i => (i + 1) % urls.length), 5000)
    return () => clearInterval(t)
  }, [urls.length])
  const scrim = scrimDark
    ? 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.5) 100%)'
    : 'linear-gradient(180deg, rgba(250,247,240,0.1) 0%, rgba(250,247,240,0.45) 100%)'
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: ready ? 1 : 0, transition: 'opacity 600ms ease' }}>
      {urls.map((u, i) => (
        <div key={u + i} style={{ position: 'absolute', inset: 0, opacity: i === idx ? 1 : 0, transition: 'opacity 1100ms ease-in-out' }}>
          <div style={{
            // Bias na horní část snímku — obličeje bývají nahoře, ať nejsou useknuté
            position: 'absolute', inset: 0, backgroundImage: `url(${u})`, backgroundSize: 'cover', backgroundPosition: 'center 35%',
            animation: 'kenburns 13s ease-in-out infinite alternate', animationDelay: `${i * -3}s`,
            transformOrigin: 'center', willChange: 'transform',
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
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, letterSpacing: '-0.01em', color: 'var(--ink)' }}>HistoryGuesser</span>
    </div>
  )
}
