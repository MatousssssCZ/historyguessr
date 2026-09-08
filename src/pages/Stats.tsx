import { useEffect, useState } from 'react'
import { currentLocale } from '@/i18n'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getUserSessions, getUserDailyResults, getCategoryHits, getMyRewards, getTitleOwnership, localDateISO, type SessionRow } from '@/lib/supabase'
import { levelFromXp } from '@/lib/leveling'
import { ACHIEVEMENTS, tierProgress, type CategoryAchievements } from '@/lib/achievements'
import Icon, { type IconName } from '@/components/Icon'
import MobileNav from '@/components/MobileNav'
import { rewardName, rewardDescription } from '@/lib/eventLocale'
import { PageShell, PageHeader } from '@/components/ui/Page'
import type { RoundResult, EarnedReward, RewardRarity } from '@/types/database'

// Barvy vzácnosti relikvií (funkční i v tmavém režimu — poloprůhledné podklady)
const RARITY: Record<RewardRarity, { border: string; bg: string; key: string }> = {
  common:    { border: 'var(--line-strong)', bg: 'var(--paper-200)',        key: 'rarCommon' },
  rare:      { border: '#5b7fa6',            bg: 'rgba(91,127,166,0.14)',   key: 'rarRare' },
  epic:      { border: '#8a6bb0',            bg: 'rgba(138,107,176,0.16)',  key: 'rarEpic' },
  legendary: { border: '#c79a3e',            bg: 'rgba(199,154,62,0.18)',   key: 'rarLegendary' },
}

const PERFECT_ROUND = 1000  // plné skóre kola (500 poloha + 500 rok)

interface Stats {
  roundsPlayed: number       // odehraná kola (solo + denní výzvy)
  totalScore: number
  avgScore: number
  bullseyes: number          // 100% přesné tipy
  avgDistance: number
  avgYearDiff: number
  pctClose: number           // % kol do 25 km
  pctExactYear: number       // % kol s přesným rokem
  roundsAbove950: number     // počet kol se skóre ≥ 950
  dailyCount: number
  dailyStreak: number
  gameScores: number[]       // chronologicky, pro graf
  trendPct: number           // % změna (2. půlka vs 1. půlka)
}

function computeStats(sessions: SessionRow[], daily: { score: number; date: string }[], profileScore: number): Stats {
  const rounds: RoundResult[] = sessions.flatMap(s => Array.isArray(s.rounds) ? s.rounds : [])
  const nR = rounds.length || 1
  const bullseyes = rounds.filter(r => (r.round_score ?? 0) >= PERFECT_ROUND).length
  const avgDistance = rounds.reduce((a, r) => a + (r.distance_km ?? 0), 0) / nR
  const avgYearDiff = rounds.reduce((a, r) => a + (r.year_diff ?? 0), 0) / nR
  const pctClose = Math.round(rounds.filter(r => (r.distance_km ?? 1e9) <= 25).length / nR * 100)
  const pctExactYear = Math.round(rounds.filter(r => (r.year_diff ?? 1) === 0).length / nR * 100)
  const roundsAbove950 = rounds.filter(r => (r.round_score ?? 0) >= 950).length + daily.filter(d => (d.score ?? 0) >= 950).length

  const gameScores = sessions.map(s => s.total_score ?? 0)
  // Trend: průměr 2. poloviny vs 1. poloviny
  let trendPct = 0
  if (gameScores.length >= 4) {
    const mid = Math.floor(gameScores.length / 2)
    const first = gameScores.slice(0, mid)
    const second = gameScores.slice(mid)
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
    const a1 = avg(first), a2 = avg(second)
    if (a1 > 0) trendPct = Math.round((a2 - a1) / a1 * 100)
  }

  // Denní série: po sobě jdoucí dny končící dnes/včera
  const days = new Set(daily.map(d => d.date))
  let dailyStreak = 0
  const d = new Date()
  const iso = (x: Date) => localDateISO(x)
  if (!days.has(iso(d))) d.setDate(d.getDate() - 1) // pokud dnes nehrál, počítej od včera
  while (days.has(iso(d))) { dailyStreak++; d.setDate(d.getDate() - 1) }

  const totalScore = profileScore || gameScores.reduce((a, b) => a + b, 0)
  // Průměr na KOLO ze surových kolových skóre (sólo + denní), ne na hru
  const roundsPlayed = rounds.length + daily.length
  const roundPoints = rounds.reduce((a, r) => a + (r.round_score ?? 0), 0) + daily.reduce((a, d) => a + (d.score ?? 0), 0)

  return {
    roundsPlayed,
    totalScore,
    avgScore: roundsPlayed > 0 ? Math.round(roundPoints / roundsPlayed) : 0,
    bullseyes,
    avgDistance: Math.round(avgDistance),
    avgYearDiff: Math.round(avgYearDiff),
    pctClose, pctExactYear, roundsAbove950,
    dailyCount: daily.length,
    dailyStreak,
    gameScores,
    trendPct,
  }
}

export interface StatsData {
  stats: Stats | null
  catHits: Record<string, number>
  dailyDates: Set<string>
  rewards: EarnedReward[]
  since: string | null
  loading: boolean
}

/** Sdílené načtení dat pro /stats i záložky Kroniky. */
export function useStatsData(): StatsData {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [catHits, setCatHits] = useState<Record<string, number>>({})
  const [dailyDates, setDailyDates] = useState<Set<string>>(new Set())
  const [rewards, setRewards] = useState<EarnedReward[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    let alive = true
    Promise.all([getUserSessions(user.id), getUserDailyResults(user.id), getCategoryHits(user.id), getMyRewards().catch(() => [])]).then(([sessions, daily, hits, rw]) => {
      if (!alive) return
      setStats(computeStats(sessions, daily, profile?.total_score ?? 0))
      setCatHits(hits)
      setDailyDates(new Set(daily.map(d => d.date)))
      setRewards(rw as EarnedReward[])
      setLoading(false)
    }).catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [user?.id, profile?.total_score])

  return { stats, catHits, dailyDates, rewards, since: profile?.created_at ? localDateISO(new Date(profile.created_at)) : null, loading }
}

/** Statistiky (overview + přesnost + denní + kalendář + trend) — bez shellu. */
export function StatsSections({ data, onPlay }: { data: StatsData; onPlay?: () => void }) {
  const { t } = useTranslation()
  const { stats, dailyDates, since } = data
  const n = (v: number) => v.toLocaleString(currentLocale())
  if (!stats) return null
  return (
    <>
      {stats.roundsPlayed === 0 && onPlay && (
        <div style={{ background: 'rgba(217,119,87,0.08)', border: '1px solid rgba(217,119,87,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 26 }}>🗺️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{t('stats.noData')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{t('stats.noDataSub')}</div>
          </div>
          <button onClick={onPlay} className="btn btn-accent" style={{ padding: '9px 16px', fontSize: 13, flexShrink: 0 }}>{t('stats.playCta')}</button>
        </div>
      )}
      <Section label={t('stats.overview')}>
        <Grid>
          <Card icon="🎲" value={n(stats.roundsPlayed)} k={t('stats.rounds')}/>
          <Card icon="🏆" value={n(stats.totalScore)} k={t('stats.totalScore')}/>
          <Card icon="📊" value={n(stats.avgScore)} k={t('stats.avgScore')}/>
          <Card icon="🎯" value={`${stats.bullseyes}×`} k={t('stats.bullseyes')} hl/>
        </Grid>
      </Section>
      <Section label={t('stats.accuracy')}>
        <Grid>
          <Card icon="📍" value={n(stats.avgDistance)} unit={t('stats.unitKm')} k={t('stats.avgDistance')}/>
          <Card icon="📅" value={n(stats.avgYearDiff)} unit={t('stats.unitYears')} k={t('stats.avgYear')}/>
          <Card icon="🎯" value={String(stats.pctClose)} unit="%" k={t('stats.close')}/>
          <Card icon="✓" value={String(stats.pctExactYear)} unit="%" k={t('stats.exactYear')}/>
        </Grid>
      </Section>
      <Section label={t('stats.daily')}>
        <Grid>
          <Card icon="🔥" value={String(stats.dailyStreak)} unit={t('stats.unitDays')} k={t('stats.streak')}/>
          <Card icon="📆" value={n(stats.dailyCount)} k={t('stats.dailyCount')}/>
        </Grid>
      </Section>
      <Section label={t('stats.dailyCalendar')}>
        <DailyYearCalendar played={dailyDates} since={since}/>
      </Section>
      <Section label={t('stats.trend')}>
        <TrendChart scores={stats.gameScores} trendPct={stats.trendPct}/>
      </Section>
    </>
  )
}

/** Odznaky (tituly + relikvie z odměn) — bez shellu, s vlastním přepínačem.
 *  `wide` = širší layout Kroniky (tituly do dvou sloupců). */
export function BadgesSections({ data, wide }: { data: StatsData; wide?: boolean }) {
  const { t } = useTranslation()
  const { stats, catHits, rewards } = data
  const [achTab, setAchTab] = useState<'titles' | 'relics'>('titles')
  const [ownership, setOwnership] = useState<Record<string, number>>({})

  // % hráčů s aktuálním titulem (nebo vyšším) — práh = počet kol aktuální hodnosti.
  useEffect(() => {
    const thr: Record<string, number> = {}
    for (const cat of ACHIEVEMENTS) {
      const { current } = tierProgress(cat.tiers, catHits[cat.id] ?? 0)
      thr[cat.id] = current?.count ?? cat.tiers[0]?.count ?? 1
    }
    getTitleOwnership(thr).then(setOwnership).catch(() => {})
  }, [catHits])

  if (!stats) return null
  const earnedTitles = ACHIEVEMENTS.filter(cat => (catHits[cat.id] ?? 0) >= (cat.tiers[0]?.count ?? 1)).length
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{t('stats.achievements')}</div>
          <h3 style={{ margin: '8px 0 0', fontFamily: 'var(--font-serif)', fontSize: wide ? 26 : 22, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{t('kron.badgesTitle')}</h3>
        </div>
        <div style={{ display: 'flex', background: 'var(--paper-200)', borderRadius: 10, padding: 3, gap: 3 }}>
          {([['titles', `${t('stats.tabTitles')} · ${earnedTitles}/${ACHIEVEMENTS.length}`], ['relics', `${t('stats.tabRelics')}${rewards.length ? ` · ${rewards.length}` : ''}`]] as const).map(([tab, lbl]) => {
            const on = achTab === tab
            return (
              <button key={tab} onClick={() => setAchTab(tab)} style={{
                border: 'none', padding: '8px 15px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5,
                fontFamily: 'var(--font-sans)', fontWeight: on ? 700 : 500,
                background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-3)',
                boxShadow: on ? '0 1px 3px rgba(42,31,23,0.1)' : 'none',
              }}>{lbl}</button>
            )
          })}
        </div>
      </div>
      {achTab === 'titles' ? (
        <>
          <div style={{ marginBottom: 16 }}><StreakMilestoneRail streak={stats.dailyStreak}/></div>
          <div style={{ display: 'grid', gridTemplateColumns: wide ? 'repeat(auto-fill, minmax(310px, 1fr))' : '1fr', gap: 14, alignItems: 'start' }}>
            {ACHIEVEMENTS.map(cat => <AchievementRow key={cat.id} cat={cat} hits={catHits[cat.id] ?? 0} ownedPct={ownership[cat.id]}/>)}
          </div>
        </>
      ) : (
        <RelicGallery rewards={rewards}/>
      )}
    </div>
  )
}

/** Sdílený proužek úrovně (XP). */
export function LevelBar() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const lvl = levelFromXp(profile?.xp ?? 0)
  const n = (v: number) => v.toLocaleString(currentLocale())
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <b style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{t('menu.level')} {lvl.level}</b>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>{n(lvl.into)} / {n(lvl.need)} XP</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: 'var(--paper-300)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.round(lvl.pct * 100)}%`, background: 'linear-gradient(90deg, #d97757, #d89a54)' }}/>
      </div>
    </div>
  )
}

/** Levý pruh Kroniky (32a): Tvá hra + Přesnost + série. */
export function StatsRail({ data }: { data: StatsData }) {
  const { t } = useTranslation()
  const { stats, dailyDates } = data
  const n = (v: number) => v.toLocaleString(currentLocale())
  if (!stats) return null

  const rows: [string, string, string?][] = [
    [t('stats.rounds'), n(stats.roundsPlayed)],
    [t('stats.totalScore'), n(stats.totalScore)],
    [t('stats.avgScore'), n(stats.avgScore)],
    [t('stats.avgDistance'), n(stats.avgDistance), t('stats.unitKm')],
    [t('stats.avgYear'), n(stats.avgYearDiff), t('stats.unitYears')],
  ]
  const bars: [string, string, number, string][] = [
    [t('stats.close'), `${stats.pctClose} %`, stats.pctClose, '#BE6240'],
    [t('stats.exactYear'), `${stats.pctExactYear} %`, stats.pctExactYear, '#B08040'],
    [t('kron.roundsAbove950'), n(stats.roundsAbove950), stats.roundsPlayed ? Math.round(stats.roundsAbove950 / stats.roundsPlayed * 100) : 0, '#4E6E88'],
  ]

  // Kompaktní mřížka posledních 12 týdnů (84 dní končících dnes)
  const today = new Date()
  const todayIso = localDateISO(today)
  const cells: { iso: string; played: boolean; future: boolean }[] = []
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const iso = localDateISO(d)
    cells.push({ iso, played: dailyDates.has(iso), future: iso > todayIso })
  }

  const cardCss: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '18px 19px' }
  const label: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-3)' }

  return (
    <div style={{ flex: '1 1 250px', minWidth: 250, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={cardCss}>
        <div style={label}>{t('kron.myGame')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
          {rows.map(([k, v, unit], i) => (
            <div key={k} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{k}</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{v}{unit && <small style={{ fontWeight: 500, fontSize: 11, color: 'var(--ink-3)', marginLeft: 3 }}>{unit}</small>}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={cardCss}>
        <div style={label}>{t('stats.accuracy')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 13 }}>
          {bars.map(([k, v, pct, col]) => (
            <div key={k}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{k}</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{v}</span>
              </div>
              <div style={{ height: 7, borderRadius: 4, background: 'var(--paper-300)', overflow: 'hidden' }}><div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: col }}/></div>
            </div>
          ))}
        </div>
      </div>

      <Link to="/streak" style={{ ...cardCss, textDecoration: 'none', display: 'block' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 18 }}>🔥</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{t('streak.days', { n: stats.dailyStreak })}</span>
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{stats.dailyStreak} {t('kron.to')} 100 →</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14,1fr)', gap: 4, marginTop: 14 }}>
          {cells.map(c => <div key={c.iso} style={{ aspectRatio: '1', borderRadius: 3, background: c.played ? '#4E6E4C' : c.future ? 'rgba(31,27,22,.05)' : 'rgba(31,27,22,.09)', boxShadow: c.iso === todayIso ? '0 0 0 2px var(--ink)' : undefined }}/>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 11 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{t('kron.last12w')}</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 11.5, color: 'var(--accent-deep, #A34E30)' }}>{t('kron.streakCta')}</span>
        </div>
      </Link>
    </div>
  )
}

export default function StatsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const data = useStatsData()
  return (
    <PageShell maxWidth={640}>
        <PageHeader eyebrow={t('menu.navKronika')} title={t('stats.title')} onBack={() => navigate('/menu')}/>
        <div style={{ marginBottom: 18 }}><LevelBar/></div>
        {data.loading || !data.stats ? (
          <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" style={{ width: 26, height: 26 }}/></div>
        ) : (
          <>
            <StatsSections data={data} onPlay={() => navigate('/play')}/>
            <div style={{ marginTop: 22 }}><BadgesSections data={data}/></div>
          </>
        )}
      <MobileNav active="badges"/>
    </PageShell>
  )
}

// Lišta milníků série (33a) — spojená linka, oranžová část = postup. Proklik na celoroční přehled.
const STREAK_MILESTONES: { days: number; icon: IconName }[] = [
  { days: 3, icon: 'flame' }, { days: 7, icon: 'calendar-check' }, { days: 14, icon: 'lightning' },
  { days: 30, icon: 'calendar-star' }, { days: 60, icon: 'diamond' }, { days: 100, icon: 'trophy' }, { days: 365, icon: 'crown' },
]
export function StreakMilestoneRail({ streak }: { streak: number }) {
  const { t } = useTranslation()
  const ms = STREAK_MILESTONES
  const n = ms.length
  const nextIdx = ms.findIndex(m => streak < m.days)
  const nextMs = nextIdx === -1 ? null : ms[nextIdx]
  // Zlomek napříč tratí (mezi středy dlaždic): interpolace mezi sousedními milníky
  let frac = 1
  if (streak <= ms[0].days) frac = streak <= 0 ? 0 : (streak / ms[0].days) * (0.5 / (n - 1))
  else if (streak < ms[n - 1].days) {
    const k = ms.reduce((acc, m, i) => (streak >= m.days ? i : acc), 0)
    const seg = (streak - ms[k].days) / (ms[k + 1].days - ms[k].days)
    frac = (k + seg) / (n - 1)
  }
  const fillW = `calc((100% - 38px) * ${Math.max(0, Math.min(1, frac))})`

  return (
    <Link to="/streak" style={{ display: 'block', textDecoration: 'none', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 15, background: 'rgba(190,98,64,0.13)', border: '1px solid rgba(190,98,64,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#BE6240' }}><Icon name="flame" size={23}/></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', color: 'var(--ink-3)' }}>{t('stats.daily').toUpperCase()}</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', letterSpacing: '-0.02em', marginTop: 3 }}>{t('streak.days', { n: streak })}</div>
          </div>
        </div>
        {nextMs && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{t('kron.streakLead')} <b style={{ fontWeight: 700, color: 'var(--ink)' }}>{t('kron.streakDays', { n: nextMs.days - streak })}</b> {t('kron.streakTail')}</span>
            <Icon name="arrow-right" size={12} style={{ color: 'var(--accent-deep, #A34E30)' }}/>
          </div>
        )}
      </div>
      <div style={{ position: 'relative', marginTop: 20 }}>
        <div style={{ position: 'absolute', left: 19, right: 19, top: 18, height: 2, background: 'rgba(31,27,22,0.1)' }}/>
        <div style={{ position: 'absolute', left: 19, top: 18, width: fillW, height: 2, background: '#BE6240' }}/>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          {ms.map((m, i) => {
            const reached = streak >= m.days
            const isNext = i === nextIdx
            const bg = reached ? '#BE6240' : isNext ? 'rgba(190,98,64,0.13)' : 'rgba(31,27,22,0.06)'
            const border = reached ? '#BE6240' : isNext ? '#BE6240' : 'rgba(31,27,22,0.12)'
            const col = reached ? '#FBF7F0' : isNext ? '#BE6240' : 'rgba(31,27,22,0.28)'
            return (
              <div key={m.days} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: bg, border: `1.5px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: col }}><Icon name={m.icon} size={17}/></div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.08em', color: reached || isNext ? '#3E362C' : 'var(--ink-3)' }}>{m.days}</span>
              </div>
            )
          })}
        </div>
      </div>
    </Link>
  )
}

// Barva a ikona kategorie (33a). Záhady/legendy = tón zamčené.
const TITLE_STYLE: Record<string, { tone: string; icon: IconName }> = {
  war: { tone: '#BE6240', icon: 'swords' },
  moments: { tone: '#8A6F4E', icon: 'archive' },
  places: { tone: '#4E6E88', icon: 'compass' },
  inventions: { tone: '#6F6455', icon: 'gear' },
  art: { tone: '#7E4E7A', icon: 'palette' },
  sports: { tone: '#4E6E4C', icon: 'medal' },
  disasters: { tone: '#A34E30', icon: 'warning' },
  mysteries: { tone: '#8A7E6C', icon: 'moon-stars' },
}
const LOCKED_TONE = '#8A7E6C'

/** Karta titulu jedné kategorie (33a): ikona v barvě kategorie, hodnost, pruh, „Ještě N× → Další". */
export function AchievementRow({ cat, hits, ownedPct }: { cat: CategoryAchievements; hits: number; ownedPct?: number }) {
  const { t } = useTranslation()
  const { current, next } = tierProgress(cat.tiers, hits)
  const style = TITLE_STYLE[cat.id] ?? { tone: LOCKED_TONE, icon: 'star' as IconName }
  const locked = !current
  const tone = locked ? LOCKED_TONE : style.tone
  const target = next?.count ?? current?.count ?? cat.tiers[cat.tiers.length - 1].count
  const barPct = locked ? 0 : Math.min(100, Math.round((hits / Math.max(1, target)) * 100))
  const currentName = current ? t('ach.' + cat.id + '.c' + current.count, current.name) : t('kron.noTitle')
  const nextName = next ? t('ach.' + cat.id + '.c' + next.count, next.name) : null
  const remaining = next ? next.count - hits : 0

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '17px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
        <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 13, background: `${tone}1f`, border: `1px solid ${tone}4d`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: locked ? 'rgba(31,27,22,0.4)' : tone }}>
          <Icon name={locked ? 'moon-stars' : style.icon} size={20}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{t('ach.' + cat.id + '.label', cat.label)}</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 21, color: locked ? 'var(--ink-2)' : 'var(--ink)', letterSpacing: '-0.02em', marginTop: 3 }}>{currentName}</div>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{hits}<span style={{ fontWeight: 500, fontSize: 12, color: 'var(--ink-3)' }}>/{target}</span></div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.1em', color: 'var(--ink-3)', marginTop: 2 }}>{t('kron.roundsShort')}</div>
          {ownedPct != null && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, marginTop: 5, color: 'var(--ink-3)' }}>
              <Icon name="users" size={11} style={{ color: '#8A7E6C' }}/>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, whiteSpace: 'nowrap' }}>{ownedPct} %</span>
            </div>
          )}
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 5, background: 'rgba(31,27,22,0.09)', overflow: 'hidden' }}>
        <div style={{ width: `${barPct}%`, height: '100%', borderRadius: 5, background: locked ? 'rgba(31,27,22,0.22)' : tone }}/>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <Icon name="arrow-right" size={11} style={{ color: '#8A7E6C', flexShrink: 0 }}/>
        {next
          ? <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--ink-2)' }}>{t('kron.titleNext1')} <b style={{ fontWeight: 700, color: 'var(--ink)' }}>{remaining}×</b> {t('kron.titleNext2')} <b style={{ fontWeight: 700, color: 'var(--ink)' }}>{nextName}</b></span>
          : <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-2)' }}>{t('kron.titleMax')}</span>}
      </div>
    </div>
  )
}

function RelicGallery({ rewards }: { rewards: EarnedReward[] }) {
  const { t } = useTranslation()
  if (rewards.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '34px 20px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16 }}>
        <div style={{ fontSize: 30, opacity: 0.5, marginBottom: 8 }}>⚱️</div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>{t('stats.relicsEmpty')}</p>
      </div>
    )
  }
  return (
    <>
      <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: '-2px 0 12px', lineHeight: 1.5 }}>{t('stats.relicsHint')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {rewards.map(r => {
          const rar = RARITY[r.rarity] ?? RARITY.common
          return (
            <div key={r.id} title={rewardDescription(r) || undefined} style={{
              background: 'var(--surface)', border: `1.5px solid ${rar.border}`, borderRadius: 14,
              padding: '16px 14px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                width: 58, height: 58, borderRadius: '50%', background: rar.bg, border: `1px solid ${rar.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, overflow: 'hidden',
              }}>
                {r.icon_url ? <img src={r.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : '⚱️'}
              </div>
              <div style={{ minWidth: 0, width: '100%' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rewardName(r)}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: rar.border, marginTop: 3 }}>{t('stats.' + rar.key)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  )
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div>
}
function Card({ icon, value, unit, k, hl }: { icon: string; value: string; unit?: string; k: string; hl?: boolean }) {
  return (
    <div style={{
      background: hl ? 'rgba(217,119,87,0.08)' : 'var(--surface)',
      border: `1px solid ${hl ? 'rgba(217,119,87,0.25)' : 'var(--line)'}`,
      borderRadius: 14, padding: 14,
    }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, letterSpacing: '-0.02em', color: hl ? 'var(--accent-deep)' : 'var(--ink)', lineHeight: 1, marginTop: 6 }}>
        {value}{unit && <small style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{unit}</small>}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>{k}</div>
    </div>
  )
}

function TrendChart({ scores, trendPct }: { scores: number[]; trendPct: number }) {
  const { t } = useTranslation()
  const W = 320, H = 96
  const verdict = trendPct >= 5
    ? { txt: t('stats.trendUp', { pct: trendPct }), bg: 'rgba(39,174,96,0.12)', col: '#1d6b3a' }
    : trendPct <= -5
      ? { txt: t('stats.trendDown', { pct: trendPct }), bg: 'rgba(192,57,43,0.1)', col: '#b3261e' }
      : { txt: t('stats.trendStable'), bg: 'var(--paper-200)', col: 'var(--ink-2)' }

  // posledních max 40 her
  const data = scores.slice(-40)
  const min = Math.min(...data, 0)
  const max = Math.max(...data, 1)
  const span = max - min || 1
  const x = (i: number) => data.length > 1 ? (i / (data.length - 1)) * W : W
  const y = (v: number) => H - 8 - ((v - min) / span) * (H - 16)
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  // lineární regrese pro trendovou čáru
  const n = data.length
  let trendLine = null as null | { x1: number; y1: number; x2: number; y2: number }
  if (n >= 2) {
    const sx = data.reduce((a, _, i) => a + i, 0)
    const sy = data.reduce((a, v) => a + v, 0)
    const sxx = data.reduce((a, _, i) => a + i * i, 0)
    const sxy = data.reduce((a, v, i) => a + i * v, 0)
    const denom = n * sxx - sx * sx
    if (denom !== 0) {
      const slope = (n * sxy - sx * sy) / denom
      const intercept = (sy - slope * sx) / n
      trendLine = { x1: x(0), y1: y(intercept), x2: x(n - 1), y2: y(intercept + slope * (n - 1)) }
    }
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 14px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, padding: '4px 11px', borderRadius: 999, background: verdict.bg, color: verdict.col }}>{verdict.txt}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)' }}>{t('stats.perGame')}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 96, display: 'block' }}>
        <polyline points={pts} fill="none" stroke="#ddd2bb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {trendLine && <line x1={trendLine.x1} y1={trendLine.y1} x2={trendLine.x2} y2={trendLine.y2} stroke="#d97757" strokeWidth="2.5" strokeDasharray="6 5" strokeLinecap="round"/>}
        {data.length > 0 && <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="4" fill="#d97757"/>}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', marginTop: 6 }}>
        <span>{t('stats.firstGames')}</span><span>{t('stats.lastGames')}</span>
      </div>
    </div>
  )
}

// Roční kalendář denní výzvy: ✓ odehráno, ✕ vynecháno (minulost), prázdné = budoucnost
function calMonths(): string[] {
  const loc = currentLocale()
  return Array.from({ length: 12 }, (_, m) =>
    new Date(2000, m, 1).toLocaleDateString(loc, { month: 'short' }).replace('.', ''))
}
function DailyYearCalendar({ played, since }: { played: Set<string>; since: string | null }) {
  const { t } = useTranslation()
  const year = new Date().getFullYear()
  const todayIso = localDateISO()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {calMonths().map((mn, mi) => {
        const dim = new Date(year, mi + 1, 0).getDate()
        return (
          <div key={mi} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ width: 26, flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase' }}>{mn}</div>
            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {Array.from({ length: dim }, (_, di) => {
                const day = di + 1
                const iso = `${year}-${String(mi + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const isPlayed = played.has(iso)
                // Budoucnost i dny před registrací = hráč neměl šanci hrát → neutrální
                const isUnavailable = iso > todayIso || (since !== null && iso < since)
                const isToday = iso === todayIso
                return (
                  <span key={day} title={`${day}. ${mi + 1}.`} style={{
                    width: 13, height: 13, borderRadius: 3, fontSize: 8, lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: isToday ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                    background: isPlayed ? 'var(--success)'
                      : isUnavailable ? 'var(--surface)'
                      : isToday ? 'var(--paper-300)'   // dnešek ještě stihnout jde → neutrální
                      : 'var(--danger-soft)',
                    color: isPlayed ? '#fff' : (isUnavailable ? 'transparent' : isToday ? 'var(--ink-3)' : 'var(--danger)'),
                  }}>{isPlayed ? '✓' : (isUnavailable ? '' : isToday ? '–' : '✕')}</span>
                )
              })}
            </div>
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--ink-3)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--success)' }}/>{t('menu.markPlayed')}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--danger-soft)', border: '1px solid var(--line)' }}/>{t('menu.markMissed')}</span>
      </div>
    </div>
  )
}
