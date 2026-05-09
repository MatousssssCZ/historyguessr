import { useEffect, useRef, useState } from 'react'
import { GuessMap, ResultMap } from '@/components/GameMap'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useGame } from '@/hooks/useGame'
import { formatYear, formatDistance } from '@/lib/scoring'
import type { Event } from '@/types/database'

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
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'rgba(13,9,6,0.85)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(245,241,232,0.08)',
        zIndex: 10, flexShrink: 0,
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

      <div style={{ flex: 1, position: 'relative' }}>
        {state.phase === 'playing' && <PanoramaViewer url={currentEvent.panorama_url}/>}
        {state.phase === 'round_result' && lastRound && (
          <RoundResult
            event={currentEvent}
            round={lastRound}
            onNext={nextRound}
            isLast={state.currentRound === roundsCount - 1}
          />
        )}
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
    if (viewerRef.current) { viewerRef.current.destroy(); viewerRef.current = null }

    viewerRef.current = pannellum.viewer(containerRef.current, {
      type: 'equirectangular',
      panorama: url,
      autoLoad: true,
      showControls: false,
      mouseZoom: true,
      hfov: 120,
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
      position: 'absolute', bottom: 20, right: 20,
      width: 680,
      background: 'rgba(245,241,232,0.97)',
      backdropFilter: 'blur(12px)',
      borderRadius: 16,
      border: '1px solid var(--line)',
      boxShadow: 'var(--shadow-lg)',
      overflow: 'hidden',
    }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', cursor: 'pointer', borderBottom: expanded ? '1px solid var(--line)' : 'none' }}
        onClick={() => setExpanded(e => !e)}
      >
        <span className="eyebrow" style={{ fontSize: 10 }}>Tvůj tip</span>
        <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Mapa */}
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Místo události</div>
            <GuessMap guessLat={guessLat} guessLng={guessLng} onGuess={onLocationChange}/>
            {guessLat !== null && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 5 }}>
                {guessLat.toFixed(2)}° {guessLat >= 0 ? 'N' : 'S'} · {guessLng?.toFixed(2)}° {guessLng! >= 0 ? 'E' : 'W'}
              </div>
            )}
          </div>

          {/* Rok */}
          <YearPicker value={guessYear} onChange={onYearChange}/>

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

// ── Year picker — slider + input + krokovací tlačítka ────
function YearPicker({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  const min = -3000; const max = 2025
  const pct = ((value - min) / (max - min)) * 100
  const label = value < 0 ? `${Math.abs(value)} př. n. l.` : `${value} n. l.`

  function step(delta: number) {
    onChange(Math.max(min, Math.min(max, value + delta)))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="label" style={{ marginBottom: 0 }}>Rok události</div>

      {/* Slider + input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, position: 'relative', height: 24 }}>
          <div style={{ position: 'absolute', top: 11, left: 0, right: 0, height: 3, background: 'var(--line-strong)', borderRadius: 2 }}/>
          <div style={{ position: 'absolute', top: 11, left: 0, width: `${pct}%`, height: 3, background: 'var(--accent)', borderRadius: 2 }}/>
          <input
            type="range" min={min} max={max} value={value}
            onChange={e => onChange(parseInt(e.target.value))}
            style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', margin: 0 }}
          />
          <div style={{
            position: 'absolute', left: `${pct}%`, top: 4,
            transform: 'translateX(-50%)',
            width: 16, height: 16, borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 0 3px rgba(217,119,87,0.25)',
            pointerEvents: 'none',
          }}/>
        </div>
        <input
          type="number"
          value={Math.abs(value)}
          min={0} max={max}
          onChange={e => {
            const v = parseInt(e.target.value) || 0
            onChange(value < 0 ? -v : v)
          }}
          style={{
            width: 72, textAlign: 'center',
            fontFamily: 'var(--font-serif)', fontSize: 18,
            border: '1px solid var(--line-strong)',
            borderRadius: 8, padding: '5px 6px',
            color: 'var(--ink)', background: 'var(--surface)',
          }}
        />
      </div>

      {/* Krokovací tlačítka + BCE/CE */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        {([-100, -10, -1, 1, 10, 100] as number[]).map(d => (
          <button
            key={d}
            onClick={() => step(d)}
            style={{
              flex: 1, padding: '5px 0',
              borderRadius: 7,
              border: '1px solid var(--line-strong)',
              background: 'transparent',
              fontSize: 11, color: 'var(--ink-2)',
              cursor: 'pointer', fontFamily: 'var(--font-mono)',
            }}
          >
            {d > 0 ? `+${d}` : d}
          </button>
        ))}
        <button
          onClick={() => onChange(-value)}
          style={{
            padding: '5px 8px',
            borderRadius: 7,
            border: `1px solid ${value < 0 ? 'var(--accent)' : 'var(--line-strong)'}`,
            background: value < 0 ? 'rgba(217,119,87,0.1)' : 'transparent',
            fontSize: 10, color: value < 0 ? 'var(--accent-deep)' : 'var(--ink-3)',
            cursor: 'pointer', fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap',
          }}
        >
          {value < 0 ? 'BCE' : 'CE'}
        </button>
      </div>

      {/* Label */}
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', letterSpacing: '-0.01em', textAlign: 'center' }}>
        {label}
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

  const yearDiffLabel = round.year_diff === 0 ? 'Přesný tip!' : `${round.year_diff} let`

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(13,9,6,0.92)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 20, padding: 20, overflowY: 'auto',
    }}>
      <div style={{
        background: 'var(--paper-50)',
        borderRadius: 20,
        maxWidth: 900, width: '100%',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        maxHeight: 'calc(100vh - 40px)',
      }}>

        {/* ── LEVÁ polovina — mapa + skóre ── */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)', overflow: 'hidden' }}>

          {/* Hlavička levé strany */}
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
            <div>
              <p className="eyebrow" style={{ marginBottom: 3 }}>Výsledek kola</p>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0, letterSpacing: '-0.01em' }}>{event.title}</h2>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div className="eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>Celkem</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--accent)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {round.round_score.toLocaleString('cs-CZ')}
              </div>
            </div>
          </div>

          {/* Mapa výsledku */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
            <ResultMap
              guessLat={round.guess_lat}
              guessLng={round.guess_lng}
              truthLat={event.lat}
              truthLng={event.lng}
              radiusKm={event.location_radius_km ?? 0}
            />
          </div>

          {/* Skóre + detaily */}
          <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'var(--paper-200)', borderRadius: 10, padding: '10px 12px' }}>
                <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>Poloha</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, letterSpacing: '-0.02em' }}>
                  {round.location_score.toLocaleString('cs-CZ')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{Math.round(round.location_score / 50)} %</div>
              </div>
              <div style={{ background: 'var(--paper-200)', borderRadius: 10, padding: '10px 12px' }}>
                <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>Rok</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, letterSpacing: '-0.02em' }}>
                  {round.year_score.toLocaleString('cs-CZ')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{Math.round(round.year_score / 50)} %</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <DetailRow label="Vzdálenost" value={formatDistance(round.distance_km)}/>
              <DetailRow label="Rozdíl v rocích" value={yearDiffLabel} highlight={round.year_diff === 0}/>
              <div style={{ height: 1, background: 'var(--line)' }}/>
              <DetailRow label="Správný rok" value={formatYear(event.year)} strong/>
              <DetailRow label="Tvůj tip" value={formatYear(round.guess_year)}/>
            </div>
          </div>

          {/* CTA */}
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
            <button className="btn btn-accent" style={{ width: '100%', fontSize: 15 }} onClick={onNext}>
              {isLast ? 'Zobrazit celkové výsledky →' : 'Další kolo →'}
            </button>
          </div>
        </div>

        {/* ── PRAVÁ polovina — info o události ── */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Obrázek */}
          {event.event_image_url ? (
            <img
              src={event.event_image_url}
              alt={event.title}
              style={{ width: '100%', height: 220, objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: '100%', height: 120, flexShrink: 0,
              background: 'var(--paper-300)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>BEZ OBRÁZKU</span>
            </div>
          )}

          {/* Popis */}
          <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
            <p className="eyebrow" style={{ marginBottom: 10 }}>O události</p>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, margin: '0 0 12px', letterSpacing: '-0.01em' }}>{event.title}</h3>
            {event.description && (
              <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>
                {event.description}
              </p>
            )}
            {event.category && (
              <div style={{ marginTop: 16 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', background: 'var(--paper-200)', padding: '3px 10px', borderRadius: 999 }}>
                  {event.category}
                </span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Helper komponenty ─────────────────────────────────────
function DetailRow({ label, value, highlight, strong }: {
  label: string; value: string; highlight?: boolean; strong?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-3)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--font-serif)',
        fontSize: strong ? 16 : 14,
        color: highlight ? 'var(--accent)' : strong ? 'var(--ink)' : 'var(--ink-2)',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
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
        bodů · {pct} % přesnost
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn-ghost" onClick={onMenu}>Menu</button>
        <button className="btn btn-accent" onClick={onPlayAgain}>Hrát znovu</button>
      </div>
    </div>
  )
}
