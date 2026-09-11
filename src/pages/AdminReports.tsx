import { useEffect, useState, useCallback, type MouseEvent, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  getReportOverview, getReportMultiplayer, getReportDailySeries, getReportCategories,
  getReportEventsRanked, getReportDailyChallenge, getReportCampaigns, getReportCampaignsOverview,
  type DailySeriesRow, type CategoryRow, type RankedEvent, type DailyChallengeRow, type CampaignReportRow,
} from '@/lib/supabase'

const PERIODS = [7, 30, 90] as const
const C_ACTIVE = 'var(--accent)'
const C_ROUNDS = '#5b7fa6'
const C_NEW = '#4e8c5a'

const nf = (n?: number) => (n != null ? n.toLocaleString('cs-CZ') : '—')
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0)

export default function AdminReportsPage() {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [days, setDays] = useState<number>(30)
  const [overview, setOverview] = useState<Record<string, number>>({})
  const [mp, setMp] = useState<Record<string, number>>({})
  const [series, setSeries] = useState<DailySeriesRow[]>([])
  const [cats, setCats] = useState<CategoryRow[]>([])
  const [events, setEvents] = useState<RankedEvent[]>([])
  const [daily, setDaily] = useState<DailyChallengeRow[]>([])
  const [campOv, setCampOv] = useState<Record<string, number>>({})
  const [camps, setCamps] = useState<CampaignReportRow[]>([])
  const [busy, setBusy] = useState(true)

  useEffect(() => { if (!loading && !isAdmin) navigate('/menu') }, [loading, isAdmin])

  useEffect(() => {
    Promise.all([getReportOverview(), getReportMultiplayer(), getReportCategories(), getReportEventsRanked(), getReportCampaignsOverview(), getReportCampaigns()])
      .then(([o, m, c, e, co, cr]) => { setOverview(o); setMp(m); setCats(c); setEvents(e); setCampOv(co); setCamps(cr) })
      .catch(() => {})
  }, [])

  const loadSeries = useCallback(async (d: number) => {
    setBusy(true)
    const [s, dc] = await Promise.all([getReportDailySeries(d), getReportDailyChallenge(d)])
    setSeries(s); setDaily(dc); setBusy(false)
  }, [])
  useEffect(() => { loadSeries(days) }, [days, loadSeries])

  const topEvents = events.slice(0, 6)
  const bottomEvents = [...events].reverse().slice(0, 6)
  const maxCat = Math.max(1, ...cats.map(c => c.plays))

  // ── Odvozené metriky ────────────────────────────────────
  const sum = (k: keyof DailySeriesRow) => series.reduce((a, r) => a + (Number(r[k]) || 0), 0)
  const sumActive = sum('active_users'), sumRounds = sum('rounds')
  const roundsPerActive = sumActive > 0 ? (sumRounds / sumActive) : 0
  const campCompletion = pct(campOv.completions ?? 0, campOv.attempts ?? 0)
  const perfectShare = pct(campOv.perfect_runs ?? 0, campOv.completions ?? 0)
  const activation = pct(overview.active_30d ?? 0, overview.registered ?? 0)
  const mpFinish = pct(mp.rooms_finished ?? 0, mp.rooms_total ?? 0)
  const avgDaily = daily.length ? Math.round(daily.reduce((a, r) => a + (r.players || 0), 0) / daily.length) : 0

  // Trend: druhá polovina období vs první polovina
  const half = Math.floor(series.length / 2)
  const trendOf = (k: keyof DailySeriesRow) => {
    if (series.length < 4) return null
    const a = series.slice(0, half).reduce((s, r) => s + (Number(r[k]) || 0), 0)
    const b = series.slice(half).reduce((s, r) => s + (Number(r[k]) || 0), 0)
    if (a === 0) return b > 0 ? 100 : 0
    return Math.round(((b - a) / a) * 100)
  }

  const span = (n: number): CSSProperties => ({ gridColumn: isMobile ? 'span 12' : `span ${n}` })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '13px 24px', background: 'color-mix(in srgb, var(--surface) 86%, transparent)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navigate('/admin')}>← Admin</button>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 19, margin: 0 }}>Reporting</h1>
        </div>
        <div style={{ display: 'flex', background: 'var(--paper-200)', borderRadius: 10, padding: 4, gap: 4 }}>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setDays(p)} style={{
              border: 'none', padding: '6px 13px', borderRadius: 7, cursor: 'pointer', fontSize: 13,
              background: days === p ? 'var(--accent)' : 'transparent', color: days === p ? '#fff' : 'var(--ink-2)', fontWeight: days === p ? 700 : 500,
            }}>{p} dní</button>
          ))}
        </div>
      </header>

      <div style={{ maxWidth: 1360, margin: '0 auto', padding: isMobile ? '14px 12px 40px' : '18px 22px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>

          {/* ── HERO KPI ───────────────────────────────── */}
          <Hero style={span(3)} label="Aktivní dnes" value={overview.active_today} accent trend={trendOf('active_users')} spark={series.map(r => r.active_users)} sparkColor={C_ACTIVE}/>
          <Hero style={span(3)} label={`Odehraná kola · ${days} dní`} value={sumRounds} trend={trendOf('rounds')} spark={series.map(r => r.rounds)} sparkColor={C_ROUNDS}/>
          <Hero style={span(3)} label={`Noví uživatelé · ${days} dní`} value={sum('new_users')} trend={trendOf('new_users')} spark={series.map(r => r.new_users)} sparkColor={C_NEW}/>
          <Hero style={span(3)} label="Dokončení kampaní" value={campOv.completions} sub={`${campCompletion} % pokusů`}/>

          {/* ── Vývoj (graf) + Poměry ─────────────────── */}
          <Panel style={span(8)} title={`Vývoj za ${days} dní`}>
            {busy ? <Spinner/> : <SeriesChart rows={series}/>}
          </Panel>
          <Panel style={span(4)} title="Poměry & zapojení">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Rate label="Kola / aktivního hráče" value={roundsPerActive.toFixed(1)} hint="hloubka zapojení"/>
              <Rate label="Aktivace" value={`${activation} %`} hint="aktivní 30 d / registr."/>
              <Rate label="Dokončenost kampaní" value={`${campCompletion} %`} hint="dokončení / pokusy"/>
              <Rate label="Podíl na 3 ★" value={`${perfectShare} %`} hint="z dokončení"/>
            </div>
          </Panel>

          {/* ── Kategorie + Kampaně ───────────────────── */}
          <Panel style={span(5)} title="Hry podle kategorie">
            {cats.length === 0 ? <Empty/> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {cats.slice(0, 8).map(c => (
                  <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 118, fontSize: 12, color: 'var(--ink-2)', flexShrink: 0, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.category}</div>
                    <div style={{ flex: 1, height: 18, background: 'var(--paper-100)', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ width: `${(c.plays / maxCat) * 100}%`, height: '100%', background: `linear-gradient(90deg, var(--accent), var(--accent-deep))`, borderRadius: 5 }}/>
                    </div>
                    <div style={{ width: 46, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)', flexShrink: 0, textAlign: 'right' }}>{c.plays}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel style={span(7)} title="Kampaně — hraní" right={<MiniStat label="hráčů" value={campOv.players}/>}>
            <CampaignTable rows={camps}/>
          </Panel>

          {/* ── Události + Kvalita ────────────────────── */}
          <Panel style={span(4)} title="Nejhranější události"><EventList rows={topEvents}/></Panel>
          <Panel style={span(4)} title="Nejméně hrané události"><EventList rows={bottomEvents}/></Panel>
          <Panel style={span(4)} title="Obsah & kvalita dat">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Rate label="Publikováno" value={nf(overview.events_published)}/>
              <Rate label="Skrytých" value={nf(overview.events_hidden)}/>
              <Rate label="Bez panoramatu" value={nf(overview.events_no_panorama)} warn={!!overview.events_no_panorama}/>
              <Rate label="Bez EN/DE" value={nf(overview.events_no_translation)} warn={!!overview.events_no_translation}/>
              <Rate label="Dny výzvy" value={`${overview.daily_assigned ?? 0}/366`}/>
              <Rate label="Registrovaných" value={nf(overview.registered)}/>
            </div>
          </Panel>

          {/* ── Denní výzva + Multiplayer ─────────────── */}
          <Panel style={span(8)} title={`Denní výzva — účast (${days} dní)`} right={<MiniStat label="ø/den" value={avgDaily}/>}>
            {busy ? <Spinner/> : <DailyChart rows={daily}/>}
          </Panel>
          <Panel style={span(4)} title="Multiplayer">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Rate label="Místností" value={nf(mp.rooms_total)}/>
              <Rate label="Dohráno" value={`${mpFinish} %`} hint={`${nf(mp.rooms_finished)} místn.`}/>
              <Rate label="Ø hráčů/místn." value={nf(mp.avg_players)}/>
              <Rate label="Klasik / BR" value={`${nf(mp.mode_classic)} / ${nf(mp.mode_br)}`}/>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

// ── Stavební prvky ────────────────────────────────────────
function Panel({ title, right, children, style }: { title: string; right?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 15px', minWidth: 0, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{title}</span>
        {right}
      </div>
      {children}
    </section>
  )
}

function Hero({ label, value, sub, accent, trend, spark, sparkColor, style }: {
  label: string; value?: number; sub?: string; accent?: boolean; trend?: number | null; spark?: number[]; sparkColor?: string; style?: CSSProperties
}) {
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '15px 16px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{label}</span>
        {trend != null && <Trend v={trend}/>}
      </div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 34, lineHeight: 1, letterSpacing: '-0.02em', color: accent ? 'var(--accent)' : 'var(--ink)' }}>{nf(value)}</div>
      {sub && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>{sub}</div>}
      {spark && spark.length > 1 && <Sparkline data={spark} color={sparkColor ?? 'var(--accent)'}/>}
    </section>
  )
}

function Trend({ v }: { v: number }) {
  const up = v >= 0
  const c = v === 0 ? 'var(--ink-3)' : up ? 'var(--success-deep, #3f7a4d)' : 'var(--danger)'
  const bg = v === 0 ? 'var(--paper-200)' : up ? 'var(--success-soft, rgba(92,148,104,.16))' : 'var(--danger-soft)'
  return (
    <span title="2. polovina období vs 1." style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '2px 7px', borderRadius: 999, background: bg, color: c, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700 }}>
      {v === 0 ? '±' : up ? '▲' : '▼'} {Math.abs(v)} %
    </span>
  )
}

function Rate({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div style={{ background: warn ? 'var(--danger-soft)' : 'var(--paper-100)', border: `1px solid ${warn ? 'color-mix(in srgb, var(--danger) 30%, transparent)' : 'var(--line)'}`, borderRadius: 11, padding: '9px 11px' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, lineHeight: 1, color: warn ? 'var(--danger)' : 'var(--ink)' }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 5 }}>{label}</div>
      {hint && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value?: number }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
      <b style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--ink)' }}>{nf(value)}</b> {label}
    </span>
  )
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 100, h = 26, max = Math.max(1, ...data)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 2) - 1}`).join(' ')
  const area = `0,${h} ${pts} ${w},${h}`
  const gid = `sg-${color.replace(/[^a-z0-9]/gi, '')}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 26, marginTop: 2 }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.28"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <polygon points={area} fill={`url(#${gid})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
    </svg>
  )
}

function Spinner() { return <div style={{ textAlign: 'center', padding: 28 }}><span className="spinner" style={{ width: 22, height: 22 }}/></div> }
function Empty() { return <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>Žádná data.</p> }

function EventList({ rows }: { rows: RankedEvent[] }) {
  if (rows.length === 0) return <Empty/>
  const max = Math.max(1, ...rows.map(r => r.play_count))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {rows.map(e => (
        <div key={e.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 11px', background: 'var(--paper-100)', borderRadius: 9, overflow: 'hidden' }}>
          <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(e.play_count / max) * 100}%`, background: 'rgba(217,119,87,0.10)' }}/>
          <span style={{ position: 'relative', flex: 1, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</span>
          <span style={{ position: 'relative', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>{e.play_count}×</span>
        </div>
      ))}
    </div>
  )
}

function CampaignTable({ rows }: { rows: CampaignReportRow[] }) {
  if (rows.length === 0) return <Empty/>
  const maxComp = Math.max(1, ...rows.map(r => r.completions))
  const th: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, padding: '0 7px 6px', textAlign: 'right', whiteSpace: 'nowrap' }
  const td: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)', padding: '6px 7px', textAlign: 'right', whiteSpace: 'nowrap' }
  return (
    <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
        <thead><tr style={{ borderBottom: '1px solid var(--line)' }}>
          <th style={{ ...th, textAlign: 'left', paddingLeft: 4 }}>Kampaň</th>
          <th style={{ ...th, textAlign: 'left' }}>Kategorie</th>
          <th style={th}>Pokusy</th><th style={th}>Dokončení</th><th style={th}>Hráči</th><th style={th}>Ø ★</th><th style={th}>Ø skóre</th>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.campaign_id} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: '6px 7px 6px 4px', fontSize: 12.5, color: 'var(--ink)', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.campaign}</td>
              <td style={{ padding: '6px 7px', fontSize: 11.5, color: 'var(--ink-3)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.category}</td>
              <td style={td}>{r.attempts}</td>
              <td style={{ ...td, position: 'relative' }}>
                <span style={{ position: 'relative', zIndex: 1, fontWeight: 700 }}>{r.completions}</span>
                <span aria-hidden style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', height: 15, width: `${(r.completions / maxComp) * 66}%`, background: 'rgba(217,119,87,0.16)', borderRadius: 4 }}/>
              </td>
              <td style={td}>{r.players}</td>
              <td style={td}>{r.avgStars != null ? r.avgStars.toFixed(2) : '—'}</td>
              <td style={td}>{r.avgScore != null ? r.avgScore.toLocaleString('cs-CZ') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Interaktivní graf denní řady ──────────────────────────
const SERIES = [
  { key: 'active_users' as const, color: C_ACTIVE, label: 'Aktivní hráči' },
  { key: 'rounds' as const, color: C_ROUNDS, label: 'Kola' },
  { key: 'new_users' as const, color: C_NEW, label: 'Noví uživatelé' },
]
function SeriesChart({ rows }: { rows: DailySeriesRow[] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (rows.length === 0) return <Empty/>
  const max = Math.max(1, ...rows.flatMap(r => [r.active_users, r.rounds, r.new_users]))
  const W = 100, H = 46
  const x = (i: number) => (rows.length === 1 ? W / 2 : (i / (rows.length - 1)) * W)
  const y = (v: number) => H - (v / max) * (H - 3) - 1.5
  const line = (k: keyof DailySeriesRow) => rows.map((r, i) => `${x(i)},${y(Number(r[k]))}`).join(' ')
  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const rel = (e.clientX - rect.left) / rect.width
    setHover(Math.max(0, Math.min(rows.length - 1, Math.round(rel * (rows.length - 1)))))
  }
  const hv = hover != null ? rows[hover] : null
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
        {SERIES.map(s => <Legend key={s.key} color={s.color} label={s.label}/>)}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ width: '100%', height: 190, overflow: 'visible', cursor: 'crosshair' }}>
        {SERIES.map(s => (
          <polyline key={s.key} points={line(s.key)} fill="none" stroke={s.color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.95}/>
        ))}
        {hover != null && <line x1={x(hover)} y1="0" x2={x(hover)} y2={H} stroke="var(--ink-3)" strokeWidth="0.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke"/>}
        {hover != null && SERIES.map(s => <circle key={s.key} cx={x(hover)} cy={y(Number(rows[hover][s.key]))} r="2" fill={s.color} vectorEffect="non-scaling-stroke"/>)}
      </svg>
      {hv && (
        <div style={{ position: 'absolute', top: 24, left: `min(calc(${(hover! / Math.max(1, rows.length - 1)) * 100}% ), calc(100% - 150px))`, pointerEvents: 'none', background: 'var(--ink-dark, #1a1611)', color: '#f5f1e8', borderRadius: 10, padding: '9px 11px', fontSize: 11.5, boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,.3))', minWidth: 140 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.6, marginBottom: 5 }}>{hv.day}</div>
          {SERIES.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, margin: '2px 0' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }}/>{s.label}</span>
              <b style={{ fontFamily: 'var(--font-serif)' }}>{nf(Number(hv[s.key]))}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DailyChart({ rows }: { rows: DailyChallengeRow[] }) {
  if (rows.length === 0) return <Empty/>
  const max = Math.max(1, ...rows.map(r => r.players))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
      {rows.map(r => (
        <div key={r.day} title={`${r.day}: ${r.players} hráčů${r.avg_score != null ? `, ø ${r.avg_score}` : ''}`}
          style={{ flex: 1, minWidth: 0, height: `${(r.players / max) * 100}%`, minHeight: 2, background: 'linear-gradient(180deg, var(--accent), var(--accent-deep))', borderRadius: '3px 3px 0 0', opacity: 0.9 }}/>
      ))}
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-2)' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: color }}/>{label}</span>
}
