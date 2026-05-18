import { useEffect, useRef, useState } from 'react'
import { GuessMap, ResultMap } from '@/components/GameMap'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useGame } from '@/hooks/useGame'
import { formatYear, formatDistance } from '@/lib/scoring'
import { addEventRating } from '@/lib/supabase'
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
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0d0906' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'rgba(13,9,6,0.85)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(245,241,232,0.08)',
        zIndex: 10, flexShrink: 0,
      }} className="game-hud">
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

// ── Guess panel — mapa + rok + odeslat ──────────────────
function GuessPanel({ guessLat, guessLng, guessYear, canSubmit, onLocationChange, onYearChange, onSubmit }: {
  guessLat: number | null; guessLng: number | null; guessYear: number
  canSubmit: boolean; onLocationChange: (lat: number, lng: number) => void
  onYearChange: (y: number) => void; onSubmit: () => void
}) {
  const [tab, setTab] = useState<'map' | 'year'>('map')
  const [expanded, setExpanded] = useState(false)
  const isMobile = window.innerWidth <= 640

  const mapPin = guessLat !== null
    ? `${guessLat.toFixed(1)}° ${guessLat >= 0 ? 'N' : 'S'} · ${guessLng?.toFixed(1)}° ${guessLng! >= 0 ? 'E' : 'W'}`
    : null

  const mapHeight = expanded ? 340 : (isMobile ? 200 : 240)

  return (
    <div style={{
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      maxWidth: isMobile ? '100%' : 380,
      marginLeft: isMobile ? 0 : 'auto',
      marginRight: isMobile ? 0 : 16,
      background: 'rgba(245,241,232,0.98)',
      backdropFilter: 'blur(16px)',
      borderRadius: isMobile ? '18px 18px 0 0' : 14,
      border: '0.5px solid rgba(42,31,23,0.15)',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.25)',
      overflow: 'hidden',
      zIndex: 20,
      marginBottom: isMobile ? 0 : 20,
    }}>

      {/* Header */}
      <div style={{
        background: '#1a1208',
        padding: '9px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', color: 'rgba(245,241,232,0.5)' }}>
          TVŮJ TIP
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {mapPin && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(245,241,232,0.4)' }}>
              {mapPin} ✓
            </span>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.18)',
              borderRadius: 6, padding: '3px 8px', fontSize: 11,
              color: 'rgba(245,241,232,0.7)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 3,
            }}
          >
            {expanded ? '↙ Sbalit' : '↗ Rozbalit'}
          </button>
        </div>
      </div>

      {/* Obsah záložky */}
      {tab === 'map' && (
        <div style={{ position: 'relative', height: mapHeight, transition: 'height 250ms ease' }}>
          <GuessMap
            guessLat={guessLat}
            guessLng={guessLng}
            onGuess={onLocationChange}
          />
        </div>
      )}

      {tab === 'year' && (
        <div style={{ padding: '18px 16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>ROK UDÁLOSTI</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 40, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--ink)' }}>
              {Math.abs(guessYear)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>
              {guessYear < 0 ? 'př. n. l.' : 'n. l.'}
            </div>
          </div>
          <YearPicker value={guessYear} onChange={onYearChange}/>
        </div>
      )}

      {/* Přepínač + Odeslat */}
      <div style={{ borderTop: '0.5px solid var(--line)' }}>
        {/* Tab bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          {([['map', '📍', 'Mapa'], ['year', '📅', 'Rok']] as const).map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '11px 0',
                border: 'none',
                borderBottom: tab === key ? '2.5px solid var(--accent)' : '2.5px solid transparent',
                background: 'transparent',
                fontSize: 13,
                fontWeight: tab === key ? 500 : 400,
                color: tab === key ? 'var(--accent)' : 'var(--ink-3)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 150ms',
              }}
            >
              <span style={{ fontSize: 15 }}>{icon}</span> {label}
            </button>
          ))}
        </div>

        {/* Odeslat */}
        <div style={{ padding: '10px 14px', paddingBottom: `calc(10px + env(safe-area-inset-bottom, 0px))` }}>
          <button
            className="btn btn-accent"
            style={{ width: '100%', fontSize: 14, opacity: canSubmit ? 1 : 0.4 }}
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            Odeslat odpověď →
          </button>
          {!canSubmit && (
            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
              {guessLat === null ? 'Klikni na mapu pro výběr místa' : 'Nastav rok události'}
            </div>
          )}
        </div>
      </div>
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
              flex: 1, padding: '10px 0',
              borderRadius: 8,
              border: '1px solid var(--line-strong)',
              background: 'transparent',
              fontSize: 13, color: 'var(--ink-2)',
              cursor: 'pointer', fontFamily: 'var(--font-mono)',
              minHeight: 44,
            }}
          >
            {d > 0 ? `+${d}` : d}
          </button>
        ))}
        <button
          onClick={() => onChange(-value)}
          style={{
            padding: '10px 10px',
            borderRadius: 8,
            border: `1px solid ${value < 0 ? 'var(--accent)' : 'var(--line-strong)'}`,
            background: value < 0 ? 'rgba(217,119,87,0.1)' : 'transparent',
            fontSize: 11, color: value < 0 ? 'var(--accent-deep)' : 'var(--ink-3)',
            cursor: 'pointer', fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap', minHeight: 44,
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
  const [tab, setTab] = useState<'score' | 'info'>('score')
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640)
  const yearDiffLabel = round.year_diff === 0 ? 'Přesný tip!' : `${round.year_diff} let`

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const nextBtn = (
    <button className="btn btn-accent" style={{ width: '100%', fontSize: 15 }} onClick={onNext}>
      {isLast ? 'Zobrazit celkové výsledky →' : 'Další kolo →'}
    </button>
  )

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(13,9,6,0.92)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 20, padding: '20px',
    }}>
      <div style={{
        background: 'var(--paper-50)',
        borderRadius: 20,
        maxWidth: isMobile ? '100%' : 900,
        width: '100%',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100dvh - 40px)',
      }}>

        {/* Hlavička */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
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

        {/* ── DESKTOP: 2 sloupce ── */}
        {!isMobile && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>
            {/* Levý — mapa + skóre */}
            <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)', overflow: 'auto' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)' }}>
                <ResultMap guessLat={round.guess_lat} guessLng={round.guess_lng} truthLat={event.lat} truthLng={event.lng} radiusKm={event.location_radius_km ?? 0}/>
              </div>
              <div style={{ padding: '16px 24px', flex: 1 }}>
                <ScoreContent round={round} yearDiffLabel={yearDiffLabel} event={event}/>
              </div>
              <div style={{ padding: '14px 24px', borderTop: '1px solid var(--line)' }}>
                {nextBtn}
              </div>
            </div>
            {/* Pravý — info */}
            <div style={{ overflow: 'auto' }}>
              <InfoContent event={event}/>
            </div>
          </div>
        )}

        {/* ── MOBIL: záložky ── */}
        {isMobile && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {tab === 'score' && (
                <div>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                    <ResultMap guessLat={round.guess_lat} guessLng={round.guess_lng} truthLat={event.lat} truthLng={event.lng} radiusKm={event.location_radius_km ?? 0}/>
                  </div>
                  <div style={{ padding: '16px' }}>
                    <ScoreContent round={round} yearDiffLabel={yearDiffLabel} event={event}/>
                  </div>
                </div>
              )}
              {tab === 'info' && <InfoContent event={event}/>}
            </div>

            {/* CTA */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
              {nextBtn}
            </div>

            {/* Tab bar */}
            <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)', display: 'flex', background: 'var(--surface)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
              {([['score', '🏆', 'Skóre'], ['info', '📖', 'O události']] as const).map(([key, icon, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  style={{
                    flex: 1, padding: '12px 0',
                    border: 'none', background: 'none',
                    borderBottom: tab === key ? '3px solid var(--accent)' : '3px solid transparent',
                    color: tab === key ? 'var(--accent)' : 'var(--ink-3)',
                    fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sdílený obsah skóre ───────────────────────────────────
function ScoreContent({ round, yearDiffLabel, event }: {
  round: NonNullable<ReturnType<typeof useGame>['lastRound']>
  yearDiffLabel: string
  event: Event
}) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div style={{ background: 'var(--paper-200)', borderRadius: 10, padding: '10px 12px' }}>
          <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>Poloha</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, letterSpacing: '-0.02em' }}>{round.location_score.toLocaleString('cs-CZ')}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{Math.round(round.location_score / 50)} %</div>
        </div>
        <div style={{ background: 'var(--paper-200)', borderRadius: 10, padding: '10px 12px' }}>
          <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>Rok</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, letterSpacing: '-0.02em' }}>{round.year_score.toLocaleString('cs-CZ')}</div>
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
    </>
  )
}

// ── Sdílený obsah info ────────────────────────────────────
function InfoContent({ event }: { event: Event }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {event.event_image_url && (
        <img src={event.event_image_url} alt={event.title} style={{ width: '100%', height: 200, objectFit: 'cover', flexShrink: 0 }}/>
      )}
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p className="eyebrow" style={{ margin: 0 }}>O události</p>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0, letterSpacing: '-0.01em' }}>{event.title}</h3>
        {event.description && (
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>{event.description}</p>
        )}
        {event.category && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', background: 'var(--paper-200)', padding: '3px 10px', borderRadius: 999, alignSelf: 'flex-start' }}>
            {event.category}
          </span>
        )}
        <div style={{ borderTop: '1px solid var(--line)', marginTop: 4 }}>
          <StarRating eventId={event.id}/>
        </div>
      </div>
    </div>
  )
}

// ── Star rating ──────────────────────────────────────────
function StarRating({ eventId }: { eventId: string }) {
  const [selected, setSelected] = useState(0)
  const [hover, setHover] = useState(0)
  const [sent, setSent] = useState(false)

  async function handleRate(rating: number) {
    if (sent) return
    setSelected(rating)
    setSent(true)
    await addEventRating(eventId, rating)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 0 4px' }}>
      <div className="eyebrow" style={{ fontSize: 9 }}>Ohodnoť kvalitu panoramy</div>
      {sent ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1,2,3,4,5].map(i => (
              <span key={i} style={{ fontSize: 22, color: i <= selected ? '#d97757' : 'var(--line-strong)' }}>★</span>
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Díky!</span>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 4 }}>
          {[1,2,3,4,5].map(i => (
            <button
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              onClick={() => handleRate(i)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 28, padding: '2px 4px',
                color: i <= (hover || selected) ? '#d97757' : 'var(--paper-300)',
                transition: 'color 100ms, transform 100ms',
                transform: i <= hover ? 'scale(1.2)' : 'scale(1)',
                lineHeight: 1,
              }}
            >
              ★
            </button>
          ))}
        </div>
      )}
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
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#0d0906' }}>
      <div className="spinner" style={{ width: 32, height: 32 }}/>
      <p style={{ color: 'var(--paper-300)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.16em' }}>NAČÍTÁM HISTORII…</p>
    </div>
  )
}

function ErrorScreen({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32, background: '#0d0906' }}>
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
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, background: 'var(--paper-100)' }}>
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
