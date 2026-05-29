import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  getDailyChallenge,
  getTodayDailyResult,
  saveDailyResult,
  getDailyLeaderboard,
  track,
} from '@/lib/supabase'
import { haversineKm, roundScore, yearDiff } from '@/lib/scoring'
import type { Event } from '@/types/database'
import type { DailyResult } from '@/lib/supabase'
import { GuessMap, ResultMap } from '@/components/GameMap'

declare const pannellum: {
  viewer: (container: HTMLElement, config: Record<string, unknown>) => { destroy: () => void }
}

// Dnešní datum jako string YYYY-MM-DD
function todayStr() {
  return new Date().toISOString().split('T')[0]
}

type Phase = 'loading' | 'no_challenge' | 'already_played' | 'playing' | 'result'

export default function DailyChallengePage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<Phase>('loading')
  const [event, setEvent] = useState<Event | null>(null)
  const [existingResult, setExistingResult] = useState<DailyResult | null>(null)
  const [leaderboard, setLeaderboard] = useState<DailyResult[]>([])

  // Guess state
  const [guessLat, setGuessLat] = useState<number | null>(null)
  const [guessLng, setGuessLng] = useState<number | null>(null)
  const [guessYear, setGuessYear] = useState(0)
  const [guessYearSet, setGuessYearSet] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [yearExpanded, setYearExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Result state
  const [result, setResult] = useState<{
    distKm: number
    locScore: number
    yrScore: number
    totalScore: number
    yrDiff: number
  } | null>(null)

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  async function load() {
    setPhase('loading')
    track('daily_challenge_started', {}, user?.id)

    const [ev, existing, lb] = await Promise.all([
      getDailyChallenge(),
      getTodayDailyResult(user!.id),
      getDailyLeaderboard(),
    ])

    setLeaderboard(lb)

    if (!ev) { setPhase('no_challenge'); return }
    setEvent(ev)

    if (existing) {
      setExistingResult(existing)
      // Rekonstruuj výsledek pro zobrazení
      if (existing.guess_lat && existing.guess_lng && existing.guess_year) {
        const dist = haversineKm(existing.guess_lat, existing.guess_lng, ev.lat, ev.lng)
        const yf = ev.year_from ?? ev.year
        const yt = ev.year_to ?? ev.year
        const yrDiff_ = yearDiff(existing.guess_year, yf, yt)
        const { location_score: locSc, year_score: yrSc } = roundScore(dist, existing.guess_year, yf, yt, ev.location_radius_km ?? 0)
        setGuessLat(existing.guess_lat)
        setGuessLng(existing.guess_lng)
        setGuessYear(existing.guess_year)
        setResult({
          distKm: dist,
          locScore: locSc,
          yrScore: yrSc,
          totalScore: existing.score,
          yrDiff: yrDiff_,
        })
      }
      setPhase('already_played')
      return
    }

    setPhase('playing')
  }

  async function handleSubmit() {
    if (!event || !user || guessLat === null || guessLng === null || !guessYearSet) return
    setSubmitting(true)

    const yf = event.year_from ?? event.year
    const yt = event.year_to ?? event.year
    const dist = haversineKm(guessLat, guessLng, event.lat, event.lng)
    const yrDiff_ = yearDiff(guessYear, yf, yt)
    const { location_score: locSc, year_score: yrSc, round_score: total } = roundScore(dist, guessYear, yf, yt, event.location_radius_km ?? 0)

    setResult({ distKm: dist, locScore: locSc, yrScore: yrSc, totalScore: total, yrDiff: yrDiff_ })

    await saveDailyResult(user.id, total, guessLat, guessLng, guessYear)
    const lb = await getDailyLeaderboard()
    setLeaderboard(lb)

    setSubmitting(false)
    setPhase('result')
  }

  const canSubmit = guessLat !== null && guessYearSet

  // ── Loading ───────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sepia-900)' }}>
        <span className="spinner" style={{ width: 28, height: 28, borderTopColor: 'var(--accent)' }}/>
      </div>
    )
  }

  // ── Dnes žádná výzva ──────────────────────────────────
  if (phase === 'no_challenge') {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--sepia-900)', gap: 16, padding: 24 }}>
        <div style={{ fontSize: 48 }}>📅</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--paper-50)', margin: 0, textAlign: 'center' }}>
          Dnes žádná výzva není
        </h1>
        <p style={{ color: 'rgba(245,241,232,0.5)', fontSize: 15, textAlign: 'center', margin: 0 }}>
          Zkus to zítra nebo zahraj klasický mód.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button className="btn btn-ghost" style={{ color: 'var(--paper-100)', borderColor: 'rgba(245,241,232,0.2)' }} onClick={() => navigate('/menu')}>← Menu</button>
          <button className="btn btn-accent" onClick={() => navigate('/game')}>Hrát klasický mód →</button>
        </div>
      </div>
    )
  }

  // ── Výsledek (po odeslání nebo already_played) ────────
  if ((phase === 'result' || phase === 'already_played') && event && result) {
    return (
      <DailyResult
        event={event}
        result={result}
        guessLat={guessLat!}
        guessLng={guessLng!}
        guessYear={guessYear}
        leaderboard={leaderboard}
        profile={profile}
        alreadyPlayed={phase === 'already_played'}
        onMenu={() => navigate('/menu')}
        onGame={() => navigate('/game')}
      />
    )
  }

  // ── Hra ───────────────────────────────────────────────
  if (phase === 'playing' && event) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0d0906', position: 'relative', overflow: 'hidden' }}>

        {/* HUD */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'rgba(13,9,6,0.85)', backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(245,241,232,0.06)',
          flexShrink: 0, zIndex: 10,
          paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--accent)', textTransform: 'uppercase' }}>Tento den v historii</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--paper-100)', marginTop: 2 }}>{event.title}</div>
          </div>
          <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12, color: 'var(--paper-100)', borderColor: 'rgba(245,241,232,0.2)' }} onClick={() => navigate('/menu')}>
            ✕ Odejít
          </button>
        </div>

        {/* Panorama */}
        <div style={{ flex: 1, position: 'relative' }}>
          <PanoramaViewer url={event.panorama_url}/>
        </div>

        {/* Guess UI — stejný jako v Game.tsx */}
        {!mapExpanded && !yearExpanded && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            zIndex: 20, padding: '10px 12px',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => setMapExpanded(true)} style={{
                display: 'flex', flexDirection: 'column',
                background: 'rgba(245,241,232,0.95)', backdropFilter: 'blur(16px)',
                border: `1.5px solid ${guessLat !== null ? '3px solid #27ae60' : 'rgba(217,119,87,0.35)'}`,
                borderRadius: 14, overflow: 'hidden', cursor: 'pointer', padding: 0,
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)', height: 100, position: 'relative',
              }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <GuessMap guessLat={guessLat} guessLng={guessLng} onGuess={(lat, lng) => { setGuessLat(lat); setGuessLng(lng) }} compact/>
                </div>
                <div style={{ padding: '6px 10px', background: guessLat !== null ? 'rgba(39,174,96,0.12)' : 'rgba(245,241,232,0.95)', borderTop: '0.5px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: guessLat !== null ? '#1d6b3a' : 'var(--ink-3)', textTransform: 'uppercase' }}>
                    {guessLat !== null ? 'Místo ✓' : 'Vybrat místo'}
                  </span>
                </div>
              </button>

              <button onClick={() => setYearExpanded(true)} style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                background: 'rgba(245,241,232,0.95)', backdropFilter: 'blur(16px)',
                border: `1.5px solid ${guessYearSet ? '#27ae60' : 'rgba(217,119,87,0.35)'}`,
                borderRadius: 14, cursor: 'pointer', padding: '14px 16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)', height: 100, textAlign: 'left', gap: 4,
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>Rok</div>
                {guessYearSet ? (
                  <>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1 }}>{Math.abs(guessYear)}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#1d6b3a' }}>{guessYear < 0 ? 'Př. n. l.' : 'N. l.'} ✓</div>
                  </>
                ) : (
                  <div style={{ fontSize: 15, color: 'var(--accent-deep)', fontWeight: 500, marginTop: 4 }}>Vybrat rok →</div>
                )}
              </button>
            </div>

            <button
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
              style={{
                width: '100%', fontSize: 15, padding: '14px 0',
                borderRadius: 12, border: 'none', fontWeight: 500,
                cursor: canSubmit ? 'pointer' : 'default',
                background: canSubmit ? 'var(--accent)' : 'rgba(245,241,232,0.7)',
                backdropFilter: 'blur(16px)',
                color: canSubmit ? '#fff' : 'var(--ink-3)',
                boxShadow: canSubmit ? '0 4px 20px rgba(217,119,87,0.4)' : 'none',
              }}
            >
              {submitting ? 'Odesílám…' : canSubmit ? 'Odeslat tip →' : (guessLat === null ? 'Zbývá vybrat místo' : 'Zbývá vybrat rok')}
            </button>
          </div>
        )}

        {/* Rozbalená mapa */}
        {mapExpanded && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <GuessMap guessLat={guessLat} guessLng={guessLng} onGuess={(lat, lng) => { setGuessLat(lat); setGuessLng(lng) }}/>
              <button onClick={() => setMapExpanded(false)} style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, background: 'rgba(13,9,6,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(245,241,232,0.2)', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: 'rgba(245,241,232,0.9)', cursor: 'pointer' }}>
                ✕ Sbalit
              </button>
            </div>
            <div style={{ background: 'rgba(245,241,232,0.97)', padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: '0.5px solid var(--line)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                {guessLat !== null ? `${guessLat.toFixed(1)}° · ${guessLng?.toFixed(1)}° ✓` : 'Klikni na mapu'}
              </span>
              <button onClick={() => setMapExpanded(false)} style={{ background: guessLat !== null ? 'var(--accent)' : 'var(--paper-400)', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 14, fontWeight: 500, color: guessLat !== null ? '#fff' : 'var(--ink-3)', cursor: 'pointer' }}>
                {guessLat !== null ? 'Potvrdit místo ✓' : 'Vyber místo…'}
              </button>
            </div>
          </div>
        )}

        {/* Rozbalený rok */}
        {yearExpanded && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(13,9,6,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', background: 'var(--paper-50)', borderRadius: '20px 20px 0 0', padding: '20px 18px', paddingBottom: 'max(20px, env(safe-area-inset-bottom))', boxShadow: '0 -8px 32px rgba(0,0,0,0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 44, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--ink)' }}>{Math.abs(guessYear) || '?'}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.14em', color: 'var(--ink-3)', marginTop: 3, textTransform: 'uppercase' }}>{guessYear < 0 ? 'Př. n. l.' : 'N. l.'}</div>
                </div>
                <button onClick={() => setYearExpanded(false)} style={{ background: 'var(--paper-200)', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--ink-2)' }}>
                  ✕ Sbalit
                </button>
              </div>
              <YearPickerInline value={guessYear} onChange={(y) => { setGuessYear(y); setGuessYearSet(true) }}/>
              <button onClick={() => setYearExpanded(false)} style={{ marginTop: 16, width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '13px 0', fontSize: 15, fontWeight: 500, color: '#fff', cursor: 'pointer' }}>
                Potvrdit rok ✓
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}

// ── Panorama viewer ───────────────────────────────────────
function PanoramaViewer({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const v = pannellum.viewer(ref.current, { type: 'equirectangular', panorama: url, autoLoad: true, showControls: false, hfov: 120 })
    return () => v.destroy()
  }, [url])
  return <div ref={ref} style={{ width: '100%', height: '100%' }}/>
}

// ── Inline year picker ────────────────────────────────────
function YearPickerInline({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  const MIN = -3000, MAX = 2025, TOTAL = MAX - MIN
  const pct = ((value - MIN) / TOTAL) * 100
  const zeroPct = ((0 - MIN) / TOTAL) * 100

  function step(d: number) {
    let next = value + d
    if (next === 0) next = d > 0 ? 1 : -1
    onChange(Math.max(MIN, Math.min(MAX, next)))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ position: 'relative', height: 28, marginBottom: 4 }}>
        <div style={{ position: 'absolute', top: 11, left: 0, right: 0, height: 6, borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${zeroPct}%`, background: 'linear-gradient(90deg,#5a8fb5,#9bbdd4)' }}/>
          <div style={{ flex: 1, background: 'linear-gradient(90deg,#e8b49a,#d97757)' }}/>
        </div>
        <div style={{ position: 'absolute', top: 5, left: `${zeroPct}%`, width: 2, height: 18, background: 'rgba(42,31,23,0.3)', transform: 'translateX(-50%)', borderRadius: 1, pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', top: 4, left: `${pct}%`, transform: 'translateX(-50%)', width: 20, height: 20, borderRadius: '50%', background: 'var(--paper-50)', border: `2.5px solid ${value < 0 ? '#7aa8cc' : '#d97757'}`, boxShadow: `0 0 0 3px ${value < 0 ? 'rgba(90,143,181,0.2)' : 'rgba(217,119,87,0.2)'}`, pointerEvents: 'none' }}/>
        <input type="range" min={MIN} max={MAX} value={value} step={1}
          onChange={e => { let v = parseInt(e.target.value); if (v === 0) v = -1; onChange(v) }}
          style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', margin: 0, height: 28 }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
        <span style={{ color: '#7aa8cc' }}>3000 př.</span>
        <span style={{ color: 'var(--ink-3)' }}>0</span>
        <span style={{ color: '#d97757' }}>2025</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
        {([-10,-1,1,10] as const).map(d => (
          <button key={d} onClick={() => step(d)} style={{ padding: '12px 0', borderRadius: 9, border: '0.5px solid var(--line-strong)', background: 'var(--paper-100)', fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--ink)', cursor: 'pointer' }}>
            {d > 0 ? `+${d}` : d}
          </button>
        ))}
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>Zadat přesný rok (− = př. n. l.)</div>
        <input type="text" inputMode="decimal" pattern="-?[0-9]*" min={MIN} max={MAX}
          value={value === 0 ? '' : String(value)}
          onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n) && n !== 0) onChange(Math.max(MIN, Math.min(MAX, n))) }}
          placeholder="-480 nebo 1912"
          style={{ width: '100%', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 18, padding: '11px 14px', border: '1px solid var(--line-strong)', borderRadius: 10, color: 'var(--ink)', background: 'var(--surface)', outline: 'none' }}
        />
      </div>
    </div>
  )
}

// ── Výsledek denní výzvy ──────────────────────────────────
function DailyResult({ event, result, guessLat, guessLng, guessYear, leaderboard, profile, alreadyPlayed, onMenu, onGame }: {
  event: Event
  result: { distKm: number; locScore: number; yrScore: number; totalScore: number; yrDiff: number }
  guessLat: number; guessLng: number; guessYear: number
  leaderboard: DailyResult[]
  profile: { username?: string | null } | null
  alreadyPlayed: boolean
  onMenu: () => void; onGame: () => void
}) {
  const locPct = Math.round(result.locScore / 50)
  const yrPct = Math.round(result.yrScore / 50)
  const isMobile = window.innerWidth <= 640

  return (
    <div style={{ height: '100dvh', background: 'var(--paper-50)', display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingTop: 'env(safe-area-inset-top,0px)' }}>

      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '0.5px solid var(--line)', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 4 }}>
          {alreadyPlayed ? 'Dnes jsi již hrál' : 'Výsledek — Tento den v historii'}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, letterSpacing: '-0.01em', flex: 1, lineHeight: 1.2 }}>{event.title}</div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--accent)', letterSpacing: '-0.03em', lineHeight: 1 }}>{result.totalScore.toLocaleString('cs-CZ')}</div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>z 10 000</div>
          </div>
        </div>
      </div>

      {/* Scrollovatelný obsah */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Mapa výsledku */}
        <div style={{ height: isMobile ? 180 : 240, flexShrink: 0 }}>
          <ResultMap guessLat={guessLat} guessLng={guessLng} truthLat={event.lat} truthLng={event.lng} radiusKm={event.location_radius_km ?? 0}/>
        </div>

        {/* Skóre */}
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <ScoreCard label="Poloha" score={result.locScore} pct={locPct} sub={result.distKm < 1 ? '<1 km' : `${Math.round(result.distKm).toLocaleString('cs-CZ')} km`}/>
            <ScoreCard label="Rok" score={result.yrScore} pct={yrPct} sub={result.yrDiff === 0 ? '✓ Přesný tip!' : `${result.yrDiff} let mimo`} highlight={result.yrDiff === 0}/>
          </div>
          <div style={{ background: 'var(--paper-200)', borderRadius: 9, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
            <div><div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>Správný rok</div><div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500 }}>{event.year < 0 ? `${Math.abs(event.year)} př. n. l.` : `${event.year} n. l.`}</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>Tvůj tip</div><div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500 }}>{guessYear < 0 ? `${Math.abs(guessYear)} př. n. l.` : `${guessYear} n. l.`}</div></div>
          </div>
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div style={{ padding: '0 14px 16px' }}>
            <div style={{ borderTop: '0.5px solid var(--line)', paddingTop: 12, marginBottom: 10 }}>
              <p className="eyebrow" style={{ fontSize: 9 }}>Dnešní žebříček</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {leaderboard.map((r, i) => {
                const isMe = r.user_id === profile?.username
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: isMe ? 'rgba(217,119,87,0.08)' : 'var(--paper-100)', borderRadius: 8, border: isMe ? '1px solid rgba(217,119,87,0.2)' : '1px solid var(--line)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: i < 3 ? ['#d4a017','#9b9b9b','#b87333'][i] : 'var(--ink-3)', width: 20, textAlign: 'center' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: isMe ? 600 : 400 }}>
                      {(r.profiles as any)?.username ?? 'Hráč'}
                      {isMe && <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 6 }}>ty</span>}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>{r.score.toLocaleString('cs-CZ')}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Akce */}
      <div style={{ flexShrink: 0, padding: '10px 14px', paddingBottom: 'max(14px,env(safe-area-inset-bottom))', borderTop: '0.5px solid var(--line)', display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onMenu}>← Menu</button>
        <button className="btn btn-accent" style={{ flex: 2 }} onClick={onGame}>Hrát klasický mód →</button>
      </div>
    </div>
  )
}

// ── Score karta ───────────────────────────────────────────
function ScoreCard({ label, score, pct, sub, highlight }: { label: string; score: number; pct: number; sub: string; highlight?: boolean }) {
  return (
    <div style={{ background: 'var(--paper-200)', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 8 }}>{score.toLocaleString('cs-CZ')}</div>
      <div style={{ height: 3, background: 'rgba(42,31,23,0.12)', borderRadius: 999, overflow: 'hidden', marginBottom: 5 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: highlight ? '#1d6b3a' : 'var(--accent)', borderRadius: 999 }}/>
      </div>
      <div style={{ fontSize: 11, color: highlight ? '#1d6b3a' : 'var(--ink-3)' }}>{sub}</div>
    </div>
  )
}
