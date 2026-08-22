import { useState, useEffect } from 'react'
import { currentLocale } from '@/i18n'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getTodayDailyResult, getUserDailyResults, getEventImages, transformedImageUrl, getFriendRequests, getWorldRank, getCategoryHits, localDateISO, getMyEntitlements, getHomeTeaser, type DailyResult, type TeaserEvent, type TeaserCampaign } from '@/lib/supabase'
import { slugify } from '@/lib/slugify'
import { eventTitle, eventDescription, localizedTitle } from '@/lib/eventLocale'
import { eventPath, campaignPath, CATEGORIES, isCategoryKey, type ExploreLocale } from '@/lib/exploreUrls'
import { formatYear } from '@/lib/scoring'
import { isPremiumUser } from '@/lib/entitlements'
import { levelFromXp } from '@/lib/leveling'
import { ACHIEVEMENTS, tierProgress } from '@/lib/achievements'
import { loadResume, RESUME_TTL, type ResumeState } from '@/lib/resume'
import { useTranslation } from 'react-i18next'
import ThemeToggle from '@/components/ThemeToggle'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import MobileNav from '@/components/MobileNav'
import Icon, { type IconName } from '@/components/Icon'
import HowToPlay from '@/components/HowToPlay'
import InstallGuide from '@/components/InstallGuide'
import { isInstallTileHidden } from '@/lib/pwaInstall'

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
  const [, setCountdown] = useState('')
  const [, setFriendReqs] = useState(0)
  const [world, setWorld] = useState<{ rank: number; total: number } | null>(null)
  const [, setRankDelta] = useState(0)
  const [catHits, setCatHits] = useState<Record<string, number>>({})
  const [resume, setResume] = useState<ResumeState | null>(null)
  const [heroImgs, setHeroImgs] = useState<string[]>([])
  const [showHowTo, setShowHowTo] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const [, setInstallTileHidden] = useState(() => isInstallTileHidden())
  const [, setIsPremium] = useState(false)
  const [teaser, setTeaser] = useState<{ events: TeaserEvent[]; campaigns: TeaserCampaign[] } | null>(null)
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
  // Locale pro odkazy do veřejné Explore vrstvy (musí být cs/en/de, ne varianta)
  const menuLoc = currentLocale()
  const eloc: ExploreLocale = menuLoc === 'en' ? 'en' : menuLoc === 'de' ? 'de' : 'cs'
  const exSeg = eloc === 'en' ? 'explore' : eloc === 'de' ? 'entdecken' : 'objevuj'

  // Teaser obsahu pod záhybem (načte se jednou; sekce se ukáže až po scrollu)
  useEffect(() => {
    let alive = true
    getHomeTeaser(6).then(r => { if (alive) setTeaser(r) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const hour = new Date().getHours()
  const greet = t(hour < 11 ? 'menu.greetMorning' : hour < 18 ? 'menu.greetAfternoon' : 'menu.greetEvening')
  const dateStr = new Date().toLocaleDateString(currentLocale(), { weekday: 'short', day: 'numeric', month: 'long' }).toUpperCase()

  const goQuick = () => navigate('/game', { state: { rounds: 1 } })
  const goClassic = () => navigate('/play')
  const goDaily = () => navigate('/daily')
  const goMP = () => navigate('/multiplayer/lobby')
  const goResume = () => navigate('/game', { state: { resume: true } })


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


  // ═══════════════════ DESKTOP ═══════════════════
  if (!isMobile) {
    const loc = menuLoc
    const dot = (on: boolean) => ({ width: 7, height: 7, borderRadius: '50%', background: on ? '#E8C88A' : 'rgba(251,247,240,.28)' })
    const nav: { label: string; onClick?: () => void; href?: string; active?: boolean }[] = [
      { label: t('menu.navHome'), onClick: () => {}, active: true },
      { label: t('menu.campaigns'), onClick: () => navigate('/campaigns') },
      { label: t('menu.navBadges'), onClick: () => navigate('/stats') },
      { label: t('menu.navFriends'), onClick: () => navigate('/friends') },
      { label: t('menu.navExplore'), href: `/${eloc}/${exSeg}` },
    ]
    const modes: { icon: IconName; title: string; sub: string; onClick: () => void; primary?: boolean }[] = [
      { icon: 'bolt', title: t('menu.quickGame'), sub: t('menu.quickGameSubShort'), onClick: goQuick, primary: true },
      { icon: 'sliders', title: t('menu.classicGame'), sub: t('menu.classicGameSubShort'), onClick: goClassic },
      { icon: 'swords', title: t('menu.multiplayer'), sub: t('menu.multiplayerSub'), onClick: goMP },
    ]
    const GLASS = { background: 'rgba(20,16,12,.55)', backdropFilter: 'blur(18px) saturate(140%)', WebkitBackdropFilter: 'blur(18px) saturate(140%)', border: '1px solid rgba(251,247,240,.14)', borderRadius: 20 } as const
    const cardLabel = { fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'rgba(251,247,240,.5)' }
    return (
      <div style={{ background: '#14110D' }}>
        <section style={{ position: 'relative', height: '100dvh', overflow: 'hidden', background: '#14110D', color: '#FBF7F0' }}>
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
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em', color: 'rgba(251,247,240,.7)' }}>🔥 {t('menu.streakDays', { n: dailyStreak })}</span>
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
              <a href={`/${eloc}/${eloc === 'en' ? 'about' : eloc === 'de' ? 'ueber-uns' : 'o-projektu'}`} style={{ textDecoration: 'none', color: 'rgba(251,247,240,.7)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13 }}>{t('menu.aboutShort')}</a>
              <LanguageSwitcher/>
              <ThemeToggle variant="dark"/>
            </div>
          </div>
        </div>
        </section>

        {/* ═══ Pod záhybem: obsahová vrstva (světlá) ═══ */}
        {(() => {
          const seg = { cs: { ex: 'objevuj', jk: 'jak-hrat', ab: 'o-projektu' }, en: { ex: 'explore', jk: 'how-to-play', ab: 'about' }, de: { ex: 'entdecken', jk: 'spielanleitung', ab: 'ueber-uns' } }[eloc]
          const kicker = { fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#6F6455' }
          const h2 = { fontFamily: 'var(--font-serif)', fontWeight: 400 as const, fontSize: 'clamp(28px, 3.2vw, 40px)', letterSpacing: '-0.03em', color: '#1F1B16', margin: '6px 0 0' }
          const moreLink = { fontFamily: 'var(--font-sans)', fontWeight: 600 as const, fontSize: 13, color: '#A34E30', textDecoration: 'none', whiteSpace: 'nowrap' as const }
          const steps = [
            { icon: 'globe' as IconName, t: t('menu.s1t'), d: t('menu.s1d') },
            { icon: 'pin' as IconName, t: t('menu.s2t'), d: t('menu.s2d') },
            { icon: 'calendar' as IconName, t: t('menu.s3t'), d: t('menu.s3d') },
            { icon: 'trophy' as IconName, t: t('menu.s4t'), d: t('menu.s4d') },
          ]
          return (
            <main style={{ background: '#FBF7F0', color: '#3E362C' }}>
              {/* Vybrané okamžiky */}
              <section style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 32px 0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={kicker}>{t('menu.exploreHistory')}</div>
                    <h2 style={h2}>{t('menu.teaserH2')}</h2>
                  </div>
                  <a href={`/${eloc}/${seg.ex}`} style={moreLink}>{t('menu.allEventsLink')} →</a>
                </div>
                <p style={{ maxWidth: 620, fontSize: 14.5, lineHeight: 1.7, color: '#5C5347', margin: '16px 0 32px' }}>{t('menu.teaserIntro')}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                  {(teaser?.events ?? []).map((ev, i) => {
                    const catKey = isCategoryKey(ev.category) ? ev.category : null
                    return (
                      <a key={i} href={eventPath(eloc, slugify(eventTitle(ev)))} style={{ background: '#FBF7F0', border: '1px solid rgba(31,27,22,.1)', borderRadius: 14, overflow: 'hidden', textDecoration: 'none', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 10px -4px rgba(31,27,22,.12)' }}>
                        <div style={{ aspectRatio: '16/9', background: '#F3EDE2' }}>{ev.img && <img loading="lazy" src={ev.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>}</div>
                        <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: '#6F6455', textTransform: 'uppercase' }}>
                            <span style={{ color: '#A34E30' }}>{catKey ? CATEGORIES[catKey][eloc].label : ''}</span>
                            <span>{formatYear(ev.year)}</span>
                          </div>
                          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, lineHeight: 1.15, color: '#1F1B16' }}>{eventTitle(ev)}</div>
                          {eventDescription(ev) && <div style={{ fontSize: 12.5, lineHeight: 1.6, color: '#3E362C', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{eventDescription(ev)}</div>}
                        </div>
                      </a>
                    )
                  })}
                </div>
              </section>

              {/* Jak to funguje */}
              <section style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 32px 0' }}>
                <div style={{ borderTop: '1px solid rgba(31,27,22,.1)', paddingTop: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={kicker}>{t('menu.howShort')}</div>
                    <h2 style={h2}>{t('menu.howH2')}</h2>
                  </div>
                  <a href={`/${eloc}/${seg.jk}`} style={moreLink}>{t('menu.howDetail')} →</a>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginTop: 28 }}>
                  {steps.map((s, i) => (
                    <div key={i} style={{ background: '#F3EDE2', border: '1px solid rgba(31,27,22,.09)', borderRadius: 16, padding: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ color: '#A34E30' }}><Icon name={s.icon} size={20}/></span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#6F6455' }}>{String(i + 1).padStart(2, '0')}</span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#1F1B16', margin: '0 0 6px' }}>{s.t}</div>
                      <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#5C5347' }}>{s.d}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Kampaně + O projektu */}
              <section style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 32px 72px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>
                  <div style={{ background: '#F3EDE2', border: '1px solid rgba(31,27,22,.09)', borderRadius: 18, padding: '24px 26px' }}>
                    <div style={kicker}>{t('menu.campaigns')}</div>
                    <h2 style={{ ...h2, fontSize: 'clamp(24px,2.6vw,30px)', margin: '6px 0 18px' }}>{t('menu.campH2')}</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(teaser?.campaigns ?? []).map((c, i) => (
                        <a key={i} href={c.slug ? campaignPath(eloc, c.slug) : `/${eloc}/${seg.ex}`} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FBF7F0', border: '1px solid rgba(31,27,22,.1)', borderRadius: 12, padding: '14px 16px', textDecoration: 'none' }}>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontFamily: 'var(--font-serif)', fontSize: 17, color: '#1F1B16' }}>{localizedTitle(c)}</span>
                            <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6F6455', marginTop: 3 }}>{c.yearFrom != null ? `${formatYear(c.yearFrom)}–${formatYear(c.yearTo ?? c.yearFrom)} · ` : ''}{c.count} {t('menu.roundsWord')}</span>
                          </span>
                          <span style={{ color: '#A34E30', fontSize: 18 }}>›</span>
                        </a>
                      ))}
                      {(!teaser || teaser.campaigns.length === 0) && <div style={{ fontSize: 13, color: '#6F6455' }}>—</div>}
                    </div>
                  </div>
                  <div style={{ background: '#F3EDE2', border: '1px solid rgba(31,27,22,.09)', borderRadius: 18, padding: '24px 26px' }}>
                    <div style={kicker}>{t('menu.aboutShort')}</div>
                    <h2 style={{ ...h2, fontSize: 'clamp(24px,2.6vw,30px)', margin: '6px 0 16px' }}>{t('menu.aboutH2')}</h2>
                    <p style={{ fontSize: 14, lineHeight: 1.7, color: '#3E362C', margin: '0 0 12px' }}>{t('menu.aboutP1')}</p>
                    <p style={{ fontSize: 14, lineHeight: 1.7, color: '#3E362C', margin: '0 0 16px' }}>{t('menu.aboutP2')}</p>
                    <a href={`/${eloc}/${seg.ab}`} style={moreLink}>{t('menu.aboutMore')} →</a>
                  </div>
                </div>
              </section>

              {/* Tmavý footer */}
              <footer style={{ background: '#1C1813', color: 'rgba(251,247,240,.7)' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 32px', display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr', gap: 28 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 8, background: ACCENT_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Icon name="globe" size={15}/></span>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#FBF7F0' }}>Historyguesser</span>
                    </div>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(251,247,240,.55)', margin: 0 }}>{t('menu.ftTagline')}</p>
                  </div>
                  {[
                    { h: t('menu.playShort'), items: [[t('menu.playShort'), '/play'], [t('menu.dailyLabel'), '/daily'], [t('menu.campaigns'), '/campaigns'], [t('menu.ftLeaderboard'), '/leaderboard']] as [string, string][] },
                    { h: t('menu.ftColDiscover'), items: [[t('menu.exploreHistory'), `/${eloc}/${seg.ex}`], [t('menu.ftCategories'), `/${eloc}/${seg.ex}`]] as [string, string][] },
                    { h: 'Historyguesser', items: [[t('menu.howShort'), `/${eloc}/${seg.jk}`], [t('menu.aboutShort'), `/${eloc}/${seg.ab}`], [t('menu.ftContact'), 'mailto:historyguesser.net@gmail.com']] as [string, string][] },
                    { h: t('menu.ftColLegal'), items: [[t('menu.ftPrivacy'), '/privacy'], [t('menu.ftTerms'), '/terms']] as [string, string][] },
                  ].map((col, ci) => (
                    <div key={ci}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(251,247,240,.4)', marginBottom: 12 }}>{col.h}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                        {col.items.map(([label, href], ii) => (
                          <a key={ii} href={href} style={{ fontSize: 13.5, color: 'rgba(251,247,240,.75)', textDecoration: 'none' }}>{label}</a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px 40px' }}><LanguageSwitcher/></div>
              </footer>
            </main>
          )
        })()}

        {showHowTo && <HowToPlay onClose={closeHowTo}/>}
        {showInstall && <InstallGuide showHideOption onClose={() => { setShowInstall(false); setInstallTileHidden(isInstallTileHidden()) }}/>}
      </div>
    )
  }

  // ═══════════════════ MOBIL (27a) ═══════════════════
  const mDot = (on: boolean) => ({ width: 7, height: 7, borderRadius: '50%', background: on ? '#E8C88A' : 'rgba(251,247,240,.28)' })
  const mModes: { icon: IconName; title: string; sub: string; onClick: () => void; primary?: boolean }[] = [
    { icon: 'bolt', title: t('menu.quickGame'), sub: t('menu.quickGameSubShort'), onClick: goQuick, primary: true },
    { icon: 'sliders', title: t('menu.classicGame'), sub: t('menu.classicGameSubShort'), onClick: goClassic },
    { icon: 'swords', title: t('menu.multiplayer'), sub: t('menu.multiplayerSub'), onClick: goMP },
  ]
  const mSeg = { ex: exSeg, jk: eloc === 'en' ? 'how-to-play' : eloc === 'de' ? 'spielanleitung' : 'jak-hrat', ab: eloc === 'en' ? 'about' : eloc === 'de' ? 'ueber-uns' : 'o-projektu' }
  const mKick = { fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#6F6455' }
  return (
    <div style={{ background: '#14110D' }}>
      {/* Hero — tmavý panorama, ~ celá první obrazovka */}
      <section style={{ position: 'relative', minHeight: '100dvh', overflow: 'hidden', background: '#14110D', color: '#FBF7F0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          {heroImgs.length > 0 ? <HeroSlideshow urls={heroImgs} scrimDark/> : <div className="skeleton" style={{ position: 'absolute', inset: 0 }}/>}
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(16,13,10,.72) 0%, rgba(16,13,10,.35) 38%, rgba(16,13,10,.96) 100%)', pointerEvents: 'none' }}/>

        {/* Top utility */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(12px + var(--safe-top)) 18px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: ACCENT_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Icon name="globe" size={15}/></span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17 }}>Historyguesser</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, height: 30, padding: '0 10px', borderRadius: 10, background: 'rgba(251,247,240,.1)', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#E8C88A' }}>🔥 {dailyStreak}</span>
            <button onClick={() => navigate('/account')} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', background: ACCENT_GRAD, color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13 }}>{name.charAt(0).toUpperCase()}</button>
          </div>
        </div>

        {/* Hero obsah (dole) */}
        <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto', padding: '0 20px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(251,247,240,.7)' }}>🔥 {t('menu.streakDays', { n: dailyStreak })}</span>
            <span style={{ display: 'flex', gap: 4 }}>{(dailyWeek.length ? dailyWeek : Array.from({ length: 7 }, () => ({ played: false }))).slice(0, 7).map((d, i) => <span key={i} style={mDot(d.played)}/>)}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'rgba(251,247,240,.75)', marginBottom: 6 }}>{greet}, {name}</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 'clamp(30px, 8vw, 40px)', lineHeight: 1.06, letterSpacing: '-0.02em', margin: '0 0 18px' }}>{t('menu.heroQuestion')}</h1>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {mModes.map((m) => (
              <button key={m.title} onClick={m.onClick} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer',
                padding: '12px 14px', borderRadius: 14,
                background: m.primary ? 'rgba(190,98,64,.92)' : 'rgba(20,16,12,.5)',
                backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                border: `1px solid ${m.primary ? 'rgba(233,161,131,.5)' : 'rgba(251,247,240,.14)'}`,
              }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(251,247,240,.14)', color: '#FBF7F0' }}><Icon name={m.icon} size={17}/></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14.5, color: '#FBF7F0' }}>{m.title}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'rgba(251,247,240,.62)', marginTop: 1 }}>{m.sub}</span>
                </span>
                <span style={{ color: 'rgba(251,247,240,.5)', fontSize: 16 }}>→</span>
              </button>
            ))}
          </div>

          <button onClick={goDaily} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', padding: 16, borderRadius: 15, border: 'none', cursor: 'pointer', background: 'rgba(251,247,240,.12)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', color: '#FBF7F0', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 15 }}>
            <Icon name="calendar" size={17}/> {dailyState === 'done' ? t('menu.results') : t('menu.playChallenge')}
          </button>

          {resume && <div style={{ marginTop: 12 }}><ResumeBar resume={resume} onResume={goResume}/></div>}
        </div>

        <a href={`/${eloc}/${mSeg.ex}`} style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid rgba(251,247,240,.14)', padding: '14px 20px', textDecoration: 'none', color: 'rgba(251,247,240,.8)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em' }}>
          ↓ {t('menu.exploreHistory').toUpperCase()}
        </a>
      </section>

      {/* Pod záhybem — světlá vrstva (jednosloupcově) */}
      <main style={{ background: '#FBF7F0', color: '#3E362C', paddingBottom: 'var(--nav-space)' }}>
        <section style={{ padding: '40px 18px 0' }}>
          <div style={mKick}>{t('menu.exploreHistory')}</div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 26, letterSpacing: '-0.02em', color: '#1F1B16', margin: '6px 0 4px' }}>{t('menu.teaserH2')}</h2>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#5C5347', margin: '10px 0 18px' }}>{t('menu.teaserIntro')}</p>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', scrollSnapType: 'x mandatory', margin: '0 -18px', padding: '0 18px 6px' }}>
            {(teaser?.events ?? []).map((ev, i) => {
              const catKey = isCategoryKey(ev.category) ? ev.category : null
              return (
                <a key={i} href={eventPath(eloc, slugify(eventTitle(ev)))} style={{ scrollSnapAlign: 'start', flex: '0 0 240px', background: '#FBF7F0', border: '1px solid rgba(31,27,22,.1)', borderRadius: 14, overflow: 'hidden', textDecoration: 'none', boxShadow: '0 2px 10px -4px rgba(31,27,22,.12)' }}>
                  <div style={{ aspectRatio: '16/9', background: '#F3EDE2' }}>{ev.img && <img loading="lazy" src={ev.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>}</div>
                  <div style={{ padding: '12px 14px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.08em', color: '#6F6455', textTransform: 'uppercase', marginBottom: 4 }}>
                      <span style={{ color: '#A34E30' }}>{catKey ? CATEGORIES[catKey][eloc].label : ''}</span><span>{formatYear(ev.year)}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, lineHeight: 1.15, color: '#1F1B16' }}>{eventTitle(ev)}</div>
                  </div>
                </a>
              )
            })}
          </div>
          <a href={`/${eloc}/${mSeg.ex}`} style={{ display: 'inline-block', marginTop: 14, fontWeight: 600, fontSize: 14, color: '#A34E30', textDecoration: 'none' }}>{t('menu.allEventsLink')} →</a>
        </section>

        <section style={{ padding: '36px 18px 0' }}>
          <div style={{ borderTop: '1px solid rgba(31,27,22,.1)', paddingTop: 28 }}>
            <div style={mKick}>{t('menu.howShort')}</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 24, letterSpacing: '-0.02em', color: '#1F1B16', margin: '6px 0 18px' }}>{t('menu.howH2')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[['globe', t('menu.s1t'), t('menu.s1d')], ['pin', t('menu.s2t'), t('menu.s2d')], ['calendar', t('menu.s3t'), t('menu.s3d')], ['trophy', t('menu.s4t'), t('menu.s4d')]].map(([ic, ti, de], i) => (
                <div key={i} style={{ display: 'flex', gap: 13, background: '#F3EDE2', border: '1px solid rgba(31,27,22,.09)', borderRadius: 14, padding: 16 }}>
                  <span style={{ color: '#A34E30', flexShrink: 0 }}><Icon name={ic as IconName} size={20}/></span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#1F1B16', marginBottom: 3 }}>{ti}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.55, color: '#5C5347' }}>{de}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: '36px 18px 40px' }}>
          <div style={{ borderTop: '1px solid rgba(31,27,22,.1)', paddingTop: 28, background: '#F3EDE2', border: '1px solid rgba(31,27,22,.09)', borderRadius: 18, padding: '22px 20px', marginTop: 0 }}>
            <div style={mKick}>{t('menu.aboutShort')}</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 22, letterSpacing: '-0.02em', color: '#1F1B16', margin: '6px 0 12px' }}>{t('menu.aboutH2')}</h2>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: '#3E362C', margin: '0 0 14px' }}>{t('menu.aboutP1')}</p>
            <a href={`/${eloc}/${mSeg.ab}`} style={{ fontWeight: 600, fontSize: 14, color: '#A34E30', textDecoration: 'none' }}>{t('menu.aboutMore')} →</a>
          </div>
        </section>
      </main>

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

// ─── Přátelé dnes (skóre za dnešek napříč režimy) ─────────
// ─── Avatar s odznakem série ──────────────────────────────

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
