import { useEffect, useRef, useState } from 'react'
import { GuessMap, ResultMap } from '@/components/GameMap'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useGame } from '@/hooks/useGame'
import { formatYear, formatDistance } from '@/lib/scoring'
import type { Event } from '@/types/database'

// Pannellum je globální (načteno z CDN v index.html)
declare const pannellum: {
  viewer: (container: string | HTMLElement, config: object) => { destroy: () => void }
}

export default function GamePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const {
    state, currentEvent, lastRound, canSubmit,
    startGame, setGuessLocation, setGuessYear, submitRound, nextRound, resetGame, roundsCount
  } = useGame(user?.id)

  // Spustit hru hned po načtení
  useEffect(() => {
    if (state.phase === 'idle') startGame()
  }, [])

  if (state.phase === 'loading') return <LoadingScreen/>
  if (state.error) return <ErrorScreen msg={state.error} onRetry={startGame}/>
  if (state.phase === 'finished') return (
    <FinishedScreen
      totalScore={state.totalScore}
      rounds={state.rounds.length}
      onPlayAgain={() => { resetGame(); startGame() }}
      onMenu={() => navigate('/menu')}
    />
  )
  if (!currentEvent) return <LoadingScreen/>

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0d0906' }}>

      {/* HUD — top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'rgba(13,9,6,0.85)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(245,241,232,0.08)',
        zIndex: 10,
        flexShrink: 0,
      }}>
        <div>
          <div className="eyebrow" style={{ color: 'var(--accent)', fontSize: 9 }}>
            Kolo {state.currentRound + 1} / {roundsCount}
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--paper-100)', marginTop: 2 }}>
            {currentEvent.title}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div className="eyebrow" style={{ color: 'rgba(245,241,232,0.4)', fontSize: 9 }}>Skóre</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--paper-100)' }}>
              {state.totalScore.toLocaleString('cs-CZ')}
            </div>
          </div>
          <button
            className="btn btn-ghost"
            style={{ padding: '6px 12px', fontSize: 12, color: 'var(--paper-100)', borderColor: 'rgba(245,241,232,0.2)' }}
            onClick={() => { resetGame(); navigate('/menu') }}
          >
            ✕ Skončit
          </button>
        </div>
      </div>

      {/* Panorama viewer — zabere zbytek výšky */}
      <div style={{ flex: 1, position: 'relative' }}>
        {state.phase === 'playing' && (
          <PanoramaViewer url={currentEvent.panorama_url}/>
        )}
        {state.phase === 'round_result' && lastRound && (
          <RoundResult event={currentEvent} round={lastRound} onNext={nextRound} isLast={state.currentRound === roundsCount - 1}/>
        )}

        {/* Guess panel (pouze při hraní) */}
        {state.phase === 'playing' && (
          <GuessPanel
            guessLat={state.guessLat}
            guessLng={state.guessLng}
            guessYear={state.guessYear}
            canSubmit={canSubmit}
            onLocationChange={setGuessLocation}
            onYearChange={setGuessYear}
            onSubmit={submitRound}
          />
        )}
      </div>
    </div>
  )
}

// ── Panorama viewer ───────────────────────────────────────
function PanoramaViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<{ destroy: () => void } | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    // Zničit předchozí viewer
    if (viewerRef.current) { viewerRef.current.destroy(); viewerRef.current = null }

    viewerRef.current = pannellum.viewer(containerRef.current, {
      type: 'equirectangular',
      panorama: url,
      autoLoad: true,
      showControls: false,
      mouseZoom: true,
      hfov: 100,
      pitch: 0,
      yaw: 0,
    })

    return () => {
      viewerRef.current?.destroy()
      viewerRef.current = null
    }
  }, [url])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }}/>
}

// ── Guess panel ───────────────────────────────────────────
function GuessPanel({ guessLat, guessLng, guessYear, canSubmit, onLocationChange, onYearChange, onSubmit }: {
  guessLat: number | null; guessLng: number | null; guessYear: number
  canSubmit: boolean; onLocationChange: (lat: number, lng: number) => void
  onYearChange: (y: number) => void; onSubmit: () => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div style={{
      position: 'absolute', bottom: 20, right: 20, left: 20,
      maxWidth: 380, marginLeft: 'auto',
      background: 'rgba(245,241,232,0.96)',
      backdropFilter: 'blur(12px)',
      borderRadius: 16,
      border: '1px solid var(--line)',
      boxShadow: 'var(--shadow-lg)',
      overflow: 'hidden',
    }}>
      {/* Header panelu */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <span className="eyebrow" style={{ fontSize: 10 }}>Tvůj tip</span>
        <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Mini mapa */}
          <div>
            <div className="label">Místo události</div>
            <GuessMap
              guessLat={guessLat}
              guessLng={guessLng}
              onGuess={onLocationChange}
            />
            {guessLat !== null && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
                {guessLat.toFixed(2)}° {guessLat >= 0 ? 'N' : 'S'} · {guessLng?.toFixed(2)}° {guessLng! >= 0 ? 'E' : 'W'}
              </div>
            )}
          </div>

          {/* Year slider */}
          <div>
            <div className="label">Rok události</div>
            <YearSlider value={guessYear} onChange={onYearChange}/>
          </div>

          <button
            className="btn btn-accent"
            style={{ width: '100%', fontSize: 14 }}
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            Odeslat odpověď →
          </button>
        </div>
      )}
    </div>
  )
}


// ── Year slider ───────────────────────────────────────────
function YearSlider({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  const min = -3000; const max = 2025
  const pct = ((value - min) / (max - min)) * 100
  const label = value < 0 ? `${Math.abs(value)} př. n. l.` : `${value} n. l.`

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'baseline' }}>
        <span className="eyebrow" style={{ fontSize: 9 }}>Rok</span>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, letterSpacing: '-0.02em' }}>{label}</span>
      </div>
      <div style={{ position: 'relative', height: 24 }}>
        <div style={{ position: 'absolute', top: 11, left: 0, right: 0, height: 2, background: 'var(--line-strong)', borderRadius: 2 }}/>
        <div style={{ position: 'absolute', top: 11, left: 0, width: `${pct}%`, height: 2, background: 'var(--accent)', borderRadius: 2 }}/>
        <input
          type="range" min={min} max={max} value={value}
          onChange={e => onChange(parseInt(e.target.value))}
          style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', margin: 0 }}
        />
        <div style={{
          position: 'absolute', left: `${pct}%`, top: 5,
          transform: 'translateX(-50%)',
          width: 14, height: 14, borderRadius: '50%',
          background: 'var(--accent)',
          boxShadow: '0 0 0 3px rgba(217,119,87,0.25)',
          pointerEvents: 'none',
        }}/>
      </div>
    </div>
  )
}

// ── Round result overlay ──────────────────────────────────
function RoundResult({ event, round, onNext, isLast }: {
  event: Event; round: ReturnType<typeof useGame>['lastRound']
  onNext: () => void; isLast: boolean
}) {
  if (!round) return null
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(13,9,6,0.92)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 20,
      padding: 20,
    }}>
      <div style={{ background: 'var(--paper-50)', borderRadius: 20, padding: 36, maxWidth: 520, width: '100%', boxShadow: 'var(--shadow-lg)' }}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>Výsledek kola</p>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, margin: '0 0 24px', letterSpacing: '-0.01em' }}>{event.title}</h2>

        {/* Skóre */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
          <ScoreStat label="Poloha" value={round.location_score} max={5000}/>
          <ScoreStat label="Rok" value={round.year_score} max={5000}/>
          <ScoreStat label="Celkem" value={round.round_score} max={10000} accent/>
        </div>

        {/* Detail */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24, padding: 16, background: 'var(--paper-200)', borderRadius: 10 }}>
          <div>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>Vzdálenost</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18 }}>{formatDistance(round.distance_km)}</div>
          </div>
          <div>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>Rozdíl v rocích</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18 }}>{round.year_diff} let</div>
          </div>
          <div>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>Správný rok</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18 }}>{formatYear(event.year)}</div>
          </div>
          <div>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>Tvůj tip</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18 }}>{formatYear(round.guess_year)}</div>
          </div>
        </div>

        {/* Popis události */}
        {event.description && (
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 24px' }}>
            {event.description}
          </p>
        )}

        {event.event_image_url && (
          <img src={event.event_image_url} alt={event.title} style={{ width: '100%', borderRadius: 8, marginBottom: 20, maxHeight: 180, objectFit: 'cover' }}/>
        )}

        <button className="btn btn-accent" style={{ width: '100%' }} onClick={onNext}>
          {isLast ? 'Zobrazit výsledky →' : 'Další kolo →'}
        </button>
      </div>
    </div>
  )
}

function ScoreStat({ label, value, max, accent }: { label: string; value: number; max: number; accent?: boolean }) {
  const pct = Math.round((value / max) * 100)
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="eyebrow" style={{ fontSize: 9, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: accent ? 28 : 22, color: accent ? 'var(--accent)' : 'var(--ink)', letterSpacing: '-0.02em' }}>
        {value.toLocaleString('cs-CZ')}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{pct}%</div>
    </div>
  )
}

// ── Loading / Error / Finished screens ───────────────────
function LoadingScreen() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#0d0906' }}>
      <div className="spinner" style={{ width: 32, height: 32 }}/>
      <p style={{ color: 'var(--paper-300)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.16em' }}>NAČÍTÁM HISTORII…</p>
    </div>
  )
}

function ErrorScreen({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32, background: '#0d0906' }}>
      <p style={{ color: 'var(--paper-200)', fontSize: 16 }}>{msg}</p>
      <button className="btn btn-accent" onClick={onRetry}>Zkusit znovu</button>
    </div>
  )
}

function FinishedScreen({ totalScore, rounds, onPlayAgain, onMenu }: {
  totalScore: number; rounds: number; onPlayAgain: () => void; onMenu: () => void
}) {
  const pct = Math.round((totalScore / (rounds * 10000)) * 100)
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, background: 'var(--paper-100)' }}>
      <p className="eyebrow" style={{ marginBottom: 16 }}>Konec hry</p>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 80, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--accent)', marginBottom: 8 }}>
        {totalScore.toLocaleString('cs-CZ')}
      </div>
      <p style={{ color: 'var(--ink-3)', marginBottom: 40, fontFamily: 'var(--font-mono)', fontSize: 14 }}>
        bodů · {pct}% přesnost
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn-ghost" onClick={onMenu}>Menu</button>
        <button className="btn btn-accent" onClick={onPlayAgain}>Hrát znovu</button>
      </div>
    </div>
  )
}
