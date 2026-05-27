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
  const isMobile = window.innerWidth <= 640

  const missingLocation = guessLat === null
  const missingYear = !canSubmit && !missingLocation
  const submitLabel = missingLocation && missingYear
    ? 'Vyber místo a rok'
    : missingLocation ? 'Zbývá vybrat místo'
    : missingYear ? 'Zbývá vybrat rok'
    : 'Odeslat odpověď →'

  const mapHeight = isMobile ? 220 : 260

  return (
    <div style={{
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      maxWidth: isMobile ? '100%' : 400,
      marginLeft: isMobile ? 0 : 'auto',
      marginRight: isMobile ? 0 : 20,
      marginBottom: isMobile ? 0 : 20,
      background: 'rgba(245,241,232,0.97)',
      backdropFilter: 'blur(20px)',
      borderRadius: isMobile ? '20px 20px 0 0' : 16,
      boxShadow: isMobile ? '0 -8px 40px rgba(0,0,0,0.3)' : '0 8px 40px rgba(0,0,0,0.3)',
      overflow: 'hidden',
      zIndex: 20,
    }}>

      {/* Mapa nebo rok */}
      <div style={{ display: tab === 'map' ? 'block' : 'none', height: mapHeight }}>
        <GuessMap guessLat={guessLat} guessLng={guessLng} onGuess={onLocationChange}/>
      </div>

      {tab === 'year' && (
        <div style={{ padding: '20px 16px 8px' }}>
          {/* Velký rok display */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 52, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--ink)' }}>
              {Math.abs(guessYear)}
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
              {guessYear < 0 ? 'PŘ. N. L.' : 'N. L.'}
            </div>
          </div>
          <YearPicker value={guessYear} onChange={onYearChange}/>
        </div>
      )}

      {/* Tab přepínač */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        borderTop: '0.5px solid var(--line)',
        background: 'rgba(245,241,232,0.5)',
      }}>
        {([['map', '🗺', 'Mapa', guessLat !== null ? '✓' : ''] ,
           ['year', '📅', 'Rok', !missingYear && canSubmit || (!missingYear && guessLat !== null) ? '✓' : '']] as const).map(([key, icon, label, check]) => (
          <button
            key={key}
            onClick={() => setTab(key as 'map' | 'year')}
            style={{
              padding: '10px 0',
              border: 'none',
              borderTop: tab === key ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              fontSize: 13,
              fontWeight: tab === key ? 600 : 400,
              color: tab === key ? 'var(--accent)' : 'var(--ink-3)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
          >
            <span style={{ fontSize: 14 }}>{icon}</span>
            {label}
            {check && <span style={{ fontSize: 10, color: '#1d6b3a', fontWeight: 700 }}>{check}</span>}
          </button>
        ))}
      </div>

      {/* Submit */}
      <div style={{ padding: `10px 14px calc(10px + env(safe-area-inset-bottom, 0px))` }}>
        <button
          className="btn btn-accent"
          style={{
            width: '100%', fontSize: 15,
            padding: '13px 0',
            opacity: canSubmit ? 1 : 0.5,
            background: canSubmit ? 'var(--accent)' : 'var(--paper-400)',
            borderColor: canSubmit ? 'var(--accent)' : 'transparent',
            color: canSubmit ? '#fff' : 'var(--ink-2)',
            transition: 'all 200ms',
          }}
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          {submitLabel}
        </button>
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
  const yearDiffLabel = round.year_diff === 0 ? '✓ Přesný tip!' : `${round.year_diff} let mimo`
  const locPct = Math.round(round.location_score / 50)
  const yrPct = Math.round(round.year_score / 50)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 640)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const nextBtn = (
    <button
      className="btn btn-accent"
      style={{ width: '100%', fontSize: 15, padding: '13px 0' }}
      onClick={onNext}
    >
      {isLast ? 'Zobrazit celkové výsledky →' : 'Další kolo →'}
    </button>
  )

  if (isMobile) {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(13,9,6,0.88)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end',
        zIndex: 20,
      }}>
        <div style={{
          background: 'var(--paper-50)',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxHeight: '92dvh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
        }}>
          {/* Header */}
          <div style={{ padding: '16px 18px 12px', borderBottom: '0.5px solid var(--line)', flexShrink: 0 }}>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>Výsledek kola</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, letterSpacing: '-0.01em', flex: 1, paddingRight: 12 }}>{event.title}</div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 34, color: 'var(--accent)', letterSpacing: '-0.03em', lineHeight: 1 }}>{round.round_score.toLocaleString('cs-CZ')}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>z 10 000</div>
              </div>
            </div>
          </div>

          {/* Scrollovatelný obsah */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {tab === 'score' && (
              <div>
                {/* Mapa */}
                <div style={{ height: 200 }}>
                  <ResultMap guessLat={round.guess_lat} guessLng={round.guess_lng} truthLat={event.lat} truthLng={event.lng} radiusKm={event.location_radius_km ?? 0}/>
                </div>
                {/* Skóre karty */}
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <ScoreCard label="Poloha" score={round.location_score} pct={locPct} sub={formatDistance(round.distance_km)}/>
                    <ScoreCard label="Rok" score={round.year_score} pct={yrPct} sub={yearDiffLabel} highlight={round.year_diff === 0}/>
                  </div>
                  <div style={{ background: 'var(--paper-200)', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div className="eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>Správný rok</div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16 }}>{formatYear(event.year)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>Tvůj tip</div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16 }}>{formatYear(round.guess_year)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {tab === 'info' && (
              <InfoContent event={event}/>
            )}
          </div>

          {/* Tab + tlačítko — pevně dole */}
          <div style={{ flexShrink: 0, borderTop: '0.5px solid var(--line)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              {([['score', '🏆', 'Skóre'], ['info', '📖', 'O události']] as const).map(([key, icon, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  style={{ padding: '10px 0', border: 'none', borderTop: tab === key ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', fontSize: 13, fontWeight: tab === key ? 600 : 400, color: tab === key ? 'var(--accent)' : 'var(--ink-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <span style={{ fontSize: 15 }}>{icon}</span>{label}
                </button>
              ))}
            </div>
            <div style={{ padding: `10px 16px calc(10px + env(safe-area-inset-bottom, 0px))` }}>
              {nextBtn}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Desktop — 2 sloupce
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,9,6,0.92)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: 20 }}>
      <div style={{ background: 'var(--paper-50)', borderRadius: 20, maxWidth: 860, width: '100%', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr', maxHeight: 'calc(100dvh - 40px)' }}>
        {/* Levý — mapa + skóre */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)', overflow: 'auto' }}>
          <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
            <div className="eyebrow" style={{ marginBottom: 3 }}>Výsledek kola</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>{event.title}</h2>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--accent)', letterSpacing: '-0.02em', lineHeight: 1 }}>{round.round_score.toLocaleString('cs-CZ')}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>z 10 000 bodů</div>
              </div>
            </div>
          </div>
          <div style={{ borderBottom: '1px solid var(--line)' }}>
            <ResultMap guessLat={round.guess_lat} guessLng={round.guess_lng} truthLat={event.lat} truthLng={event.lng} radiusKm={event.location_radius_km ?? 0}/>
          </div>
          <div style={{ padding: '16px 24px', flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <ScoreCard label="Poloha" score={round.location_score} pct={locPct} sub={formatDistance(round.distance_km)}/>
              <ScoreCard label="Rok" score={round.year_score} pct={yrPct} sub={yearDiffLabel} highlight={round.year_diff === 0}/>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-3)', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <span>Správný rok: <strong style={{ color: 'var(--ink)' }}>{formatYear(event.year)}</strong></span>
              <span>Tvůj tip: <strong style={{ color: 'var(--ink)' }}>{formatYear(round.guess_year)}</strong></span>
            </div>
          </div>
          <div style={{ padding: '12px 24px 16px', borderTop: '1px solid var(--line)' }}>{nextBtn}</div>
        </div>
        {/* Pravý — info */}
        <div style={{ overflow: 'auto' }}><InfoContent event={event}/></div>
      </div>
    </div>
  )
}

// ── Score karta ───────────────────────────────────────────
function ScoreCard({ label, score, pct, sub, highlight }: { label: string; score: number; pct: number; sub: string; highlight?: boolean }) {
  return (
    <div style={{ background: 'var(--paper-200)', borderRadius: 12, padding: '12px 14px' }}>
      <div className="eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 8 }}>
        {score.toLocaleString('cs-CZ')}
      </div>
      <div style={{ height: 3, background: 'rgba(42,31,23,0.12)', borderRadius: 999, overflow: 'hidden', marginBottom: 5 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: highlight ? '#1d6b3a' : 'var(--accent)', borderRadius: 999 }}/>
      </div>
      <div style={{ fontSize: 11, color: highlight ? '#1d6b3a' : 'var(--ink-3)' }}>{sub}</div>
    </div>
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
