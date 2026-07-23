import { useEffect, useState } from 'react'
import { currentLocale } from '@/i18n'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getUserSessions, getUserDailyResults, getCategoryHits, getMyRewards, localDateISO, type SessionRow } from '@/lib/supabase'
import { levelFromXp } from '@/lib/leveling'
import { ACHIEVEMENTS, tierProgress, type CategoryAchievements } from '@/lib/achievements'
import MobileNav from '@/components/MobileNav'
import DesktopSidebar from '@/components/DesktopSidebar'
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
  games: number
  totalScore: number
  avgScore: number
  bullseyes: number          // 100% přesné tipy
  avgDistance: number
  avgYearDiff: number
  pctClose: number           // % kol do 25 km
  pctExactYear: number       // % kol s přesným rokem
  dailyCount: number
  dailyStreak: number
  gameScores: number[]       // chronologicky, pro graf
  trendPct: number           // % změna (2. půlka vs 1. půlka)
}

function computeStats(sessions: SessionRow[], daily: { score: number; date: string }[], profileGames: number, profileScore: number): Stats {
  const rounds: RoundResult[] = sessions.flatMap(s => Array.isArray(s.rounds) ? s.rounds : [])
  const nR = rounds.length || 1
  const bullseyes = rounds.filter(r => (r.round_score ?? 0) >= PERFECT_ROUND).length
  const avgDistance = rounds.reduce((a, r) => a + (r.distance_km ?? 0), 0) / nR
  const avgYearDiff = rounds.reduce((a, r) => a + (r.year_diff ?? 0), 0) / nR
  const pctClose = Math.round(rounds.filter(r => (r.distance_km ?? 1e9) <= 25).length / nR * 100)
  const pctExactYear = Math.round(rounds.filter(r => (r.year_diff ?? 1) === 0).length / nR * 100)

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

  const games = profileGames || sessions.length
  const totalScore = profileScore || gameScores.reduce((a, b) => a + b, 0)

  return {
    games, totalScore,
    avgScore: games > 0 ? Math.round(totalScore / games) : 0,
    bullseyes,
    avgDistance: Math.round(avgDistance),
    avgYearDiff: Math.round(avgYearDiff),
    pctClose, pctExactYear,
    dailyCount: daily.length,
    dailyStreak,
    gameScores,
    trendPct,
  }
}

export default function StatsPage() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [catHits, setCatHits] = useState<Record<string, number>>({})
  const [dailyDates, setDailyDates] = useState<Set<string>>(new Set())
  const [rewards, setRewards] = useState<EarnedReward[]>([])
  const [achTab, setAchTab] = useState<'titles' | 'relics'>('titles')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    let alive = true
    Promise.all([getUserSessions(user.id), getUserDailyResults(user.id), getCategoryHits(user.id), getMyRewards().catch(() => [])]).then(([sessions, daily, hits, rw]) => {
      if (!alive) return
      setStats(computeStats(sessions, daily, profile?.games_played ?? 0, profile?.total_score ?? 0))
      setCatHits(hits)
      setDailyDates(new Set(daily.map(d => d.date)))
      setRewards(rw as EarnedReward[])
      setLoading(false)
    }).catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [user?.id, profile?.games_played, profile?.total_score])

  const lvl = levelFromXp(profile?.xp ?? 0)
  const n = (v: number) => v.toLocaleString(currentLocale())

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--paper-200)' }}>
      <DesktopSidebar/>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 'var(--safe-top)', paddingBottom: 'var(--nav-space)' }}>
      {/* Hlavička (Pergamen) */}
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 16px' }}>
          <button onClick={() => navigate('/menu')} aria-label={t('pregame.backToMenu')} style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
            background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
          }}>←</button>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 25, color: 'var(--ink)', letterSpacing: '-0.01em', margin: 0 }}>{t('stats.title')}</h1>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <b style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{t('menu.level')} {lvl.level}</b>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>{n(lvl.into)} / {n(lvl.need)} XP</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--paper-300)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round(lvl.pct * 100)}%`, background: 'linear-gradient(90deg, #d97757, #d89a54)' }}/>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '18px 18px 24px' }}>
        {loading || !stats ? (
          <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" style={{ width: 26, height: 26 }}/></div>
        ) : (
          <>
            {stats.games === 0 && stats.dailyCount === 0 && (
              <div style={{ background: 'rgba(217,119,87,0.08)', border: '1px solid rgba(217,119,87,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 26 }}>🗺️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{t('stats.noData')}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{t('stats.noDataSub')}</div>
                </div>
                <button onClick={() => navigate('/play')} className="btn btn-accent" style={{ padding: '9px 16px', fontSize: 13, flexShrink: 0 }}>{t('stats.playCta')}</button>
              </div>
            )}
            <Section label={t('stats.overview')}>
              <Grid>
                <Card icon="🎮" value={n(stats.games)} k={t('stats.games')}/>
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
              <DailyYearCalendar played={dailyDates} since={profile?.created_at ? localDateISO(new Date(profile.created_at)) : null}/>
            </Section>

            <Section label={t('stats.trend')}>
              <TrendChart scores={stats.gameScores} trendPct={stats.trendPct}/>
            </Section>

            <div style={{ marginTop: 22 }}>
              {/* Hlavička sekce s přepínačem Tituly / Relikvie */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{t('stats.achievements')}</span>
                <div style={{ display: 'flex', background: 'var(--paper-200)', borderRadius: 10, padding: 3, gap: 3 }}>
                  {([['titles', t('stats.tabTitles')], ['relics', `${t('stats.tabRelics')}${rewards.length ? ` · ${rewards.length}` : ''}`]] as const).map(([tab, lbl]) => {
                    const on = achTab === tab
                    return (
                      <button key={tab} onClick={() => setAchTab(tab)} style={{
                        border: 'none', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5,
                        fontFamily: 'var(--font-sans)', fontWeight: on ? 600 : 500,
                        background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-3)',
                        boxShadow: on ? '0 1px 3px rgba(42,31,23,0.1)' : 'none',
                      }}>{lbl}</button>
                    )
                  })}
                </div>
              </div>

              {achTab === 'titles' ? (
                <>
                  <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: '-2px 0 10px', lineHeight: 1.5 }}>{t('stats.achHowto')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {ACHIEVEMENTS.map(cat => (
                      <AchievementRow key={cat.id} cat={cat} hits={catHits[cat.id] ?? 0}/>
                    ))}
                  </div>
                </>
              ) : (
                <RelicGallery rewards={rewards}/>
              )}
            </div>
          </>
        )}
      </div>
      </div>
      <MobileNav active="badges"/>
    </div>
  )
}

function AchievementRow({ cat, hits }: { cat: CategoryAchievements; hits: number }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { current, next } = tierProgress(cat.tiers, hits)
  const target = next?.count ?? cat.tiers[cat.tiers.length - 1].count
  const prevCount = current?.count ?? 0
  const pct = next ? Math.round(((hits - prevCount) / (target - prevCount)) * 100) : 100

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '12px 14px', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 9 }}>
          <div style={{ fontSize: 23, width: 46, height: 46, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 13, background: current ? 'linear-gradient(150deg,#d97757,#b85a3e)' : 'var(--paper-300)', filter: current ? 'none' : 'grayscale(1)', opacity: current ? 1 : 0.5 }}>
            {current ? current.icon : cat.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: current ? 'var(--ink)' : 'var(--ink-2)', letterSpacing: '-0.01em' }}>{current ? current.name : cat.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-3)', marginTop: 2, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{cat.label} · {hits}× ≥950</div>
          </div>
          {next
            ? <div style={{ textAlign: 'right', flexShrink: 0 }}><div style={{ fontSize: 16, lineHeight: 1, opacity: 0.5 }}>{next.icon}</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-3)', marginTop: 2 }}>{hits}/{next.count}</div></div>
            : <span style={{ fontSize: 11, color: 'var(--accent)' }}>✓ max</span>}
          <span style={{ fontSize: 11, color: 'var(--ink-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms', marginLeft: 2 }}>▾</span>
        </div>
        <div style={{ height: 4, background: 'var(--paper-200)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }}/>
        </div>
        {next && <div style={{ fontSize: 11, color: 'var(--accent-deep)', marginTop: 6 }}>{t('stats.achToNext', { n: next.count - hits, name: next.name })}</div>}
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--line)', padding: '4px 8px 8px' }}>
          {cat.tiers.map(tier => {
            const done = hits >= tier.count
            const isNext = !done && next?.count === tier.count
            return (
              <div key={tier.count} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderRadius: 8, background: isNext ? 'rgba(217,119,87,0.08)' : 'transparent' }}>
                <div style={{ fontSize: 18, width: 28, textAlign: 'center', filter: done || isNext ? 'none' : 'grayscale(1)', opacity: done || isNext ? 1 : 0.4 }}>{tier.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: done ? 500 : 400, color: done ? 'var(--ink)' : 'var(--ink-2)' }}>{tier.name}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>{tier.count}× ≥950</div>
                </div>
                {done
                  ? <span style={{ fontSize: 11, color: '#1d6b3a' }}>✓ {t('stats.achDone')}</span>
                  : isNext
                    ? <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>{t('stats.achRemain', { n: tier.count - hits })}</span>
                    : <span style={{ fontSize: 12, opacity: 0.45 }}>🔒</span>}
              </div>
            )
          })}
        </div>
      )}
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
            <div key={r.id} title={r.description ?? undefined} style={{
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
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--ink)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
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
