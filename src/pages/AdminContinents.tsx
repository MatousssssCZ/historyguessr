import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { recomputeContinents, setEventContinent, type ContinentBatchResult } from '@/lib/supabase'
import { CONTINENTS } from '@/lib/continent'

// Admin-only, česky (dle pravidla projektu).
export default function AdminContinentsPage() {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [result, setResult] = useState<ContinentBatchResult | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => { if (!loading && !isAdmin) navigate('/menu') }, [loading, isAdmin])

  async function run() {
    setRunning(true)
    try { setResult(await recomputeContinents()) }
    catch (e) { alert('Přepočet selhal: ' + (e as Error).message) }
    setRunning(false)
  }

  async function fix(id: string, continent: string) {
    await setEventContinent(id, continent)
    setResult(r => r ? { ...r, uncertain: r.uncertain.filter(u => u.id !== id) } : r)
  }

  const pct = result && result.total > 0 ? Math.round((result.confident / result.total) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navigate('/admin')}>← Admin</button>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>🌍 Kontinenty z GPS</h1>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '2px 0 0' }}>Offline odvození ze souřadnic · hranice ke kontrole ručně</p>
        </div>
      </header>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: 24 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, marginBottom: 18 }}>
          <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 14px' }}>
            Dopočítá kontinent všem událostem z jejich GPS. Ručně nastavené hodnoty nepřepíše.
            Nejisté případy (hranice kontinentů, oceán) nechá prázdné a vypíše je níže k ruční kontrole —
            filtr kontinentu v Single Playeru dává smysl zapnout, až bude spolehlivost dost vysoká.
          </p>
          <button className="btn btn-accent" disabled={running} onClick={run}>
            {running ? 'Počítám…' : '↻ Přepočítat kontinenty'}
          </button>
        </div>

        {result && (
          <>
            {/* Report přesnosti */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
              <Stat label="Celkem" value={result.total}/>
              <Stat label="Spolehlivě" value={result.confident} accent="#5c9468"/>
              <Stat label="Nejisté" value={result.uncertain.length} accent="#c0392b"/>
              <Stat label="Změněno" value={result.updated}/>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 16px', marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 6 }}>
                <span>Spolehlivost odvození</span><span style={{ fontFamily: 'var(--font-mono)' }}>{pct} %</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'var(--paper-300)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? '#5c9468' : pct >= 70 ? '#d89a54' : '#c0392b', borderRadius: 999 }}/>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '8px 0 0' }}>
                {pct >= 90 ? '✓ Dost vysoká — filtr kontinentu lze zapnout.'
                  : 'Zatím nízká — než filtr zapneš, dořeš nejisté případy ručně.'}
              </p>
            </div>

            {/* Nejisté k ruční kontrole */}
            {result.uncertain.length > 0 && (
              <div>
                <p className="eyebrow" style={{ marginBottom: 10 }}>Ke kontrole ({result.uncertain.length})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.uncertain.map(u => (
                    <div key={u.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>{u.title}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>
                          {u.lat.toFixed(2)}, {u.lng.toFixed(2)}{u.guess && ` · tip: ${u.guess}`}
                        </div>
                      </div>
                      <select className="input" defaultValue="" style={{ maxWidth: 190 }}
                        onChange={e => { if (e.target.value) fix(u.id, e.target.value) }}>
                        <option value="">Nastavit ručně…</option>
                        {CONTINENTS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: accent ?? 'var(--ink)' }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 2 }}>{label}</div>
    </div>
  )
}
