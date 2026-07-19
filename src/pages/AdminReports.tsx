import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  getReportOverview, getReportMultiplayer, getReportDailySeries, getReportCategories,
  getReportEventsRanked, getReportDailyChallenge,
  type DailySeriesRow, type CategoryRow, type RankedEvent, type DailyChallengeRow,
} from '@/lib/supabase'

const PERIODS = [7, 30, 90] as const

export default function AdminReportsPage() {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [days, setDays] = useState<number>(30)
  const [overview, setOverview] = useState<Record<string, number>>({})
  const [mp, setMp] = useState<Record<string, number>>({})
  const [series, setSeries] = useState<DailySeriesRow[]>([])
  const [cats, setCats] = useState<CategoryRow[]>([])
  const [events, setEvents] = useState<RankedEvent[]>([])
  const [daily, setDaily] = useState<DailyChallengeRow[]>([])
  const [busy, setBusy] = useState(true)

  useEffect(() => { if (!loading && !isAdmin) navigate('/menu') }, [loading, isAdmin])

  // Stálá data (nezávislá na období)
  useEffect(() => {
    Promise.all([getReportOverview(), getReportMultiplayer(), getReportCategories(), getReportEventsRanked()])
      .then(([o, m, c, e]) => { setOverview(o); setMp(m); setCats(c); setEvents(e) })
      .catch(() => {})
  }, [])

  // Časové řady dle období
  const loadSeries = useCallback(async (d: number) => {
    setBusy(true)
    const [s, dc] = await Promise.all([getReportDailySeries(d), getReportDailyChallenge(d)])
    setSeries(s); setDaily(dc); setBusy(false)
  }, [])
  useEffect(() => { loadSeries(days) }, [days, loadSeries])

  const topEvents = events.slice(0, 8)
  const bottomEvents = [...events].reverse().slice(0, 8)
  const maxCat = Math.max(1, ...cats.map(c => c.plays))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navigate('/admin')}>← Admin</button>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>📊 Reporting</h1>
        </div>
        <div style={{ display: 'flex', background: 'var(--paper-200)', borderRadius: 10, padding: 4, gap: 4 }}>
          {PERIODS.map(p => (
            <button key={p} onClick={() => setDays(p)} style={{
              border: 'none', padding: '6px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 13,
              background: days === p ? 'var(--accent)' : 'transparent', color: days === p ? '#fff' : 'var(--ink-2)', fontWeight: days === p ? 600 : 400,
            }}>{p} dní</button>
          ))}
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 60px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* KPI */}
        <Section title="Uživatelé & aktivita">
          <Grid>
            <Kpi label="Registrovaných" value={overview.registered}/>
            <Kpi label="S přezdívkou" value={overview.with_username}/>
            <Kpi label="Aktivní dnes" value={overview.active_today} hl/>
            <Kpi label="Aktivní 7 dní" value={overview.active_7d}/>
            <Kpi label="Aktivní 30 dní" value={overview.active_30d}/>
            <Kpi label="Odehraných her celkem" value={overview.games_total}/>
          </Grid>
        </Section>

        {/* Časová řada */}
        <Section title={`Vývoj za ${days} dní`}>
          {busy ? <Spinner/> : <SeriesChart rows={series}/>}
        </Section>

        {/* Kategorie */}
        <Section title="Hry podle kategorie">
          {cats.length === 0 ? <Empty/> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cats.map(c => (
                <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 150, fontSize: 13, color: 'var(--ink-2)', flexShrink: 0, textAlign: 'right' }}>{c.category}</div>
                  <div style={{ flex: 1, height: 22, background: 'var(--paper-100)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${(c.plays / maxCat) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 6 }}/>
                  </div>
                  <div style={{ width: 60, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink)', flexShrink: 0 }}>{c.plays}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Top / Bottom události */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Section title="Nejhranější události">
            <EventList rows={topEvents}/>
          </Section>
          <Section title="Nejméně hrané události">
            <EventList rows={bottomEvents}/>
          </Section>
        </div>

        {/* Kvalita obsahu */}
        <Section title="Obsah & kvalita dat">
          <Grid>
            <Kpi label="Publikovaných událostí" value={overview.events_published}/>
            <Kpi label="Skrytých událostí" value={overview.events_hidden}/>
            <Kpi label="Bez panoramatu" value={overview.events_no_panorama} warn={!!overview.events_no_panorama}/>
            <Kpi label="Bez EN/DE překladu" value={overview.events_no_translation} warn={!!overview.events_no_translation}/>
            <Kpi label="Přiřazených dní výzvy" value={overview.daily_assigned} sub="/ 366"/>
          </Grid>
        </Section>

        {/* Denní výzva */}
        <Section title={`Denní výzva — účast (${days} dní)`}>
          {busy ? <Spinner/> : <DailyChart rows={daily}/>}
        </Section>

        {/* Multiplayer */}
        <Section title="Multiplayer">
          <Grid>
            <Kpi label="Místností celkem" value={mp.rooms_total}/>
            <Kpi label="Dohraných" value={mp.rooms_finished}/>
            <Kpi label="Ø hráčů/místnost" value={mp.avg_players}/>
            <Kpi label="Klasický mód" value={mp.mode_classic}/>
            <Kpi label="Battle Royale" value={mp.mode_br}/>
          </Grid>
        </Section>
      </div>
    </div>
  )
}

// ── Sdílené ───────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow" style={{ marginBottom: 12 }}>{title}</p>
      {children}
    </div>
  )
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>{children}</div>
}
function Kpi({ label, value, sub, hl, warn }: { label: string; value?: number; sub?: string; hl?: boolean; warn?: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${warn ? 'rgba(192,57,43,0.3)' : 'var(--line)'}`, borderRadius: 14, padding: 16 }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 30, letterSpacing: '-0.02em', color: warn ? 'var(--danger)' : hl ? 'var(--accent)' : 'var(--ink)', lineHeight: 1 }}>
        {value != null ? value.toLocaleString('cs-CZ') : '—'}<small style={{ fontSize: 13, color: 'var(--ink-3)' }}>{sub}</small>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>{label}</div>
    </div>
  )
}
function Spinner() { return <div style={{ textAlign: 'center', padding: 30 }}><span className="spinner" style={{ width: 24, height: 24 }}/></div> }
function Empty() { return <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>Žádná data.</p> }

function EventList({ rows }: { rows: RankedEvent[] }) {
  if (rows.length === 0) return <Empty/>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map(e => (
        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10 }}>
          <span style={{ flex: 1, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>{e.play_count}×</span>
        </div>
      ))}
    </div>
  )
}

// Jednoduchý sloupcový graf — aktivní hráči + hry/den
function SeriesChart({ rows }: { rows: DailySeriesRow[] }) {
  if (rows.length === 0) return <Empty/>
  const max = Math.max(1, ...rows.map(r => Math.max(r.active_users, r.games, r.new_users)))
  const W = 1000, H = 160, pad = 10
  const bw = (W - pad * 2) / rows.length
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2)
  const line = (key: keyof DailySeriesRow, _color: string) =>
    rows.map((r, i) => `${pad + i * bw + bw / 2},${y(r[key] as number)}`).join(' ')
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12 }}>
        <Legend color="var(--accent)" label="Aktivní hráči"/>
        <Legend color="#5b7fa6" label="Hry"/>
        <Legend color="#1d6b3a" label="Noví uživatelé"/>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 160, display: 'block' }}>
        <polyline points={line('active_users', '')} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round"/>
        <polyline points={line('games', '')} fill="none" stroke="#5b7fa6" strokeWidth="2" strokeLinejoin="round"/>
        <polyline points={line('new_users', '')} fill="none" stroke="#1d6b3a" strokeWidth="2" strokeDasharray="4 4" strokeLinejoin="round"/>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 6 }}>
        <span>{rows[0]?.day}</span><span>{rows[rows.length - 1]?.day}</span>
      </div>
    </div>
  )
}
function DailyChart({ rows }: { rows: DailyChallengeRow[] }) {
  if (rows.length === 0) return <Empty/>
  const max = Math.max(1, ...rows.map(r => r.players))
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'flex-end', gap: 2, height: 140 }}>
      {rows.map(r => (
        <div key={r.day} title={`${r.day}: ${r.players} hráčů${r.avg_score != null ? `, ø ${r.avg_score}` : ''}`}
          style={{ flex: 1, height: `${(r.players / max) * 100}%`, minHeight: r.players > 0 ? 2 : 0, background: 'var(--accent)', borderRadius: '3px 3px 0 0', opacity: 0.85 }}/>
      ))}
    </div>
  )
}
function Legend({ color, label }: { color: string; label: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ink-3)' }}><span style={{ width: 12, height: 3, background: color, borderRadius: 2 }}/>{label}</span>
}
