import { useEffect, useState } from 'react'
import { currentLocale } from '@/i18n'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getUserSessions, getUserDailyResults, getCategoryHits, type SessionRow } from '@/lib/supabase'
import { levelFromXp } from '@/lib/leveling'
import { ACHIEVEMENTS, tierProgress } from '@/lib/achievements'
import BackButton from '@/components/BackButton'
import type { RoundResult } from '@/types/database'

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
  const iso = (x: Date) => x.toISOString().split('T')[0]
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    let alive = true
    Promise.all([getUserSessions(user.id), getUserDailyResults(user.id), getCategoryHits(user.id)]).then(([sessions, daily, hits]) => {
      if (!alive) return
      setStats(computeStats(sessions, daily, profile?.games_played ?? 0, profile?.total_score ?? 0))
      setCatHits(hits)
      setLoading(false)
    }).catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [user?.id, profile?.games_played, profile?.total_score])

  const lvl = levelFromXp(profile?.xp ?? 0)
  const n = (v: number) => v.toLocaleString(currentLocale())

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-100)', paddingBottom: 'max(20px, var(--safe-bottom))' }}>
      {/* Hlavička */}
      <div style={{ position: 'relative', background: 'var(--feature-bg)', padding: 'calc(var(--safe-top) + 18px) 22px 22px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -60, right: -50, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,119,87,0.16), transparent 70%)', pointerEvents: 'none' }}/>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', marginBottom: 14 }}>
          <BackButton onClick={() => navigate('/menu')} label={t('pregame.backToMenu')} />
          <button onClick={() => navigate('/account')} style={{ background: 'var(--feature-line)', border: '1px solid var(--feature-line)', borderRadius: 8, padding: '6px 12px', color: 'var(--feature-fg2)', fontSize: 12, cursor: 'pointer' }}>⚙ {t('common.account')}</button>
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--feature-fg)', letterSpacing: '-0.02em', position: 'relative', margin: 0 }}>{t('stats.title')}</h1>
        <div style={{ marginTop: 16, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <b style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--feature-fg)' }}>{t('menu.level')} {lvl.level}</b>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--feature-fg2)' }}>{n(lvl.into)} / {n(lvl.need)} XP</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--feature-line)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round(lvl.pct * 100)}%`, background: 'linear-gradient(90deg, #d97757, #e89a82)' }}/>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '18px 18px 24px' }}>
        {loading || !stats ? (
          <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" style={{ width: 26, height: 26 }}/></div>
        ) : (stats.games === 0 && stats.dailyCount === 0) ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', marginBottom: 6 }}>{t('stats.noData')}</p>
            <p style={{ fontSize: 14 }}>{t('stats.noDataSub')}</p>
            <button onClick={() => navigate('/play')} className="btn btn-accent" style={{ marginTop: 18, padding: '12px 24px', borderRadius: 12 }}>{t('stats.playCta')}</button>
          </div>
        ) : (
          <>
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

            <Section label={t('stats.trend')}>
              <TrendChart scores={stats.gameScores} trendPct={stats.trendPct}/>
            </Section>

            <Section label={t('stats.achievements')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ACHIEVEMENTS.map(cat => {
                  const hits = catHits[cat.id] ?? 0
                  const { current, next } = tierProgress(cat.tiers, hits)
                  const target = next?.count ?? cat.tiers[cat.tiers.length - 1].count
                  const prevCount = current?.count ?? 0
                  const pct = next
                    ? Math.round(((hits - prevCount) / (target - prevCount)) * 100)
                    : 100
                  return (
                    <div key={cat.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div style={{ fontSize: 22, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: current ? 'rgba(217,119,87,0.1)' : 'var(--paper-200)', filter: current ? 'none' : 'grayscale(1)', opacity: current ? 1 : 0.55 }}>
                          {current ? current.icon : cat.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>
                            {current ? current.name : cat.label}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>
                            {cat.icon} {cat.label} · {hits}× ≥950
                          </div>
                        </div>
                        {next && (
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 16, lineHeight: 1, opacity: 0.5 }}>{next.icon}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-3)', marginTop: 2 }}>{hits}/{next.count}</div>
                          </div>
                        )}
                        {!next && <span style={{ fontSize: 11, color: 'var(--accent)' }}>✓ max</span>}
                      </div>
                      <div style={{ height: 4, background: 'var(--paper-200)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
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
