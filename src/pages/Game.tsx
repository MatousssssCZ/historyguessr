import { useEffect, useRef, useState } from 'react'
import { GuessMap, ResultMap } from '@/components/GameMap'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useGame } from '@/hooks/useGame'
import { formatYear, formatDistance } from '@/lib/scoring'
import { addEventRating, track } from '@/lib/supabase'
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
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0d0906', position: 'relative', overflow: 'hidden' }}>
      {/* HUD — kompaktní */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'rgba(13,9,6,0.75)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(245,241,232,0.06)',
        zIndex: 10, flexShrink: 0,
      }} className="game-hud">
        <div className="eyebrow" style={{ color: 'var(--accent)', fontSize: 10 }}>
          Kolo {state.currentRound + 1} / {roundsCount}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div className="eyebrow" style={{ color: 'rgba(245,241,232,0.35)', fontSize: 9 }}>Skóre</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--paper-100)' }}>
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
        {/* Skrytý viewer pro prefetch dalšího kola — Pannellum skutečně načte obrázek */}
        {state.phase === 'playing' && state.events[state.currentRound + 1]?.panorama_url &&
          state.events[state.currentRound + 1].panorama_url !== 'pending' && (
          <div style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', overflow: 'hidden', top: 0, left: 0 }}>
            <PanoramaViewer url={state.events[state.currentRound + 1].panorama_url}/>
          </div>
        )}

        {/* Název — výrazný overlay vlevo nahoře na panoramě */}
        {state.phase === 'playing' && (
          <div style={{
            position: 'absolute', top: 14, left: 16, zIndex: 15,
            maxWidth: 'min(400px, 58vw)', pointerEvents: 'none',
          }}>
            <div style={{
              background: 'rgba(13,9,6,0.6)',
              backdropFilter: 'blur(14px)',
              border: '1px solid rgba(245,241,232,0.12)',
              borderRadius: 12, padding: '10px 16px',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                letterSpacing: '0.18em', color: 'var(--accent)',
                textTransform: 'uppercase', marginBottom: 5,
              }}>Historická událost</div>
              <div style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(15px, 2.2vw, 22px)',
                color: 'var(--paper-50)',
                letterSpacing: '-0.01em', lineHeight: 1.2,
              }}>
                {currentEvent.title}
              </div>
            </div>
          </div>
        )}

        {state.phase === 'playing' && (
          <GuessPanel
            guessLat={state.guessLat}
            guessLng={state.guessLng}
            guessYear={state.guessYear}
            guessYearSet={state.guessYearSet}
            canSubmit={canSubmit}
            onLocationChange={setGuessLocation}
            onYearChange={setGuessYear}
            onSubmit={submitRound}
          />
        )}
      </div>

      {/* RoundResult — jako sibling HUDu, pokrývá celou obrazovku */}
      {state.phase === 'round_result' && lastRound && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 100,
        }}>
          <RoundResult
            event={currentEvent}
            round={lastRound}
            onNext={nextRound}
            isLast={state.currentRound === roundsCount - 1}
          />
        </div>
      )}
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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }}/>
      <FullscreenButton/>
    </div>
  )
}

// ── Fullscreen button ────────────────────────────────────
function FullscreenButton() {
  const [isFs, setIsFs] = useState(false)

  async function toggle() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {})
      setIsFs(true)
    } else {
      await document.exitFullscreen().catch(() => {})
      setIsFs(false)
    }
  }

  useEffect(() => {
    const h = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  return (
    <button
      onClick={toggle}
      style={{
        position: 'absolute', top: 12, right: 12,
        background: 'rgba(13,9,6,0.55)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(245,241,232,0.15)',
        borderRadius: 8, padding: '7px 10px',
        color: 'rgba(245,241,232,0.8)', cursor: 'pointer',
        fontSize: 16, lineHeight: 1, zIndex: 5,
        transition: 'background 160ms',
      }}
      title={isFs ? 'Ukončit fullscreen' : 'Fullscreen'}
    >
      {isFs ? '⛶' : '⛶'}
    </button>
  )
}

// ── Guess panel — GeoGuessr styl ─────────────────────────
function GuessPanel({ guessLat, guessLng, guessYear, guessYearSet, canSubmit, onLocationChange, onYearChange, onSubmit }: {
  guessLat: number | null; guessLng: number | null; guessYear: number
  guessYearSet: boolean
  canSubmit: boolean; onLocationChange: (lat: number, lng: number) => void
  onYearChange: (y: number) => void; onSubmit: () => void
}) {
  const [mapExpanded, setMapExpanded] = useState(false)
  const [yearExpanded, setYearExpanded] = useState(false)
  const isMobile = window.innerWidth <= 640

  const missingLocation = guessLat === null
  const missingYear = !canSubmit && !missingLocation
  const submitLabel = missingLocation && missingYear
    ? 'Vyber místo a rok'
    : missingLocation ? 'Zbývá vybrat místo'
    : missingYear ? 'Zbývá vybrat rok'
    : 'Odeslat odpověď →'

  const mapPin = guessLat !== null
    ? `${guessLat.toFixed(1)}°${guessLat >= 0 ? 'N' : 'S'} ${guessLng?.toFixed(1)}°${(guessLng ?? 0) >= 0 ? 'E' : 'W'}`
    : null

  if (!isMobile) {
    // Desktop — původní layout vpravo dole
    return (
      <div style={{
        position: 'absolute', bottom: 20, right: 20,
        width: 360,
        background: 'rgba(245,241,232,0.97)',
        backdropFilter: 'blur(20px)',
        borderRadius: 16,
        boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
        overflow: 'hidden', zIndex: 20,
      }}>
        <div style={{ height: 240 }}>
          <GuessMap guessLat={guessLat} guessLng={guessLng} onGuess={onLocationChange}/>
        </div>
        <div style={{ padding: '14px 16px 8px' }}>
          <YearPicker value={guessYear} onChange={onYearChange}/>
        </div>
        <div style={{ padding: '10px 16px 16px', borderTop: '0.5px solid var(--line)' }}>
          <button
            className="btn btn-accent"
            style={{ width: '100%', fontSize: 14, opacity: canSubmit ? 1 : 0.5 }}
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    )
  }

  // ── MOBIL: GeoGuessr styl ─────────────────────────────
  return (
    <>
      {/* Rozbalená mapa — fullscreen overlay */}
      {mapExpanded && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 30,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <GuessMap guessLat={guessLat} guessLng={guessLng} onGuess={(lat, lng) => { onLocationChange(lat, lng) }}/>
            {/* Sbalit tlačítko */}
            <button
              onClick={() => setMapExpanded(false)}
              style={{
                position: 'absolute', top: 12, right: 12, zIndex: 10,
                background: 'rgba(13,9,6,0.7)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(245,241,232,0.2)',
                borderRadius: 8, padding: '8px 14px',
                fontSize: 13, color: 'rgba(245,241,232,0.9)', cursor: 'pointer',
              }}
            >
              ✕ Sbalit
            </button>
          </div>
          {/* Potvrzení místa */}
          <div style={{
            background: 'rgba(245,241,232,0.97)',
            padding: '12px 16px',
            paddingBottom: 'max(12px, calc(env(safe-area-inset-bottom) + 8px))',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, borderTop: '0.5px solid var(--line)',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
              {mapPin ? `${mapPin} ✓` : 'Klikni na mapu'}
            </span>
            <button
              onClick={() => setMapExpanded(false)}
              style={{
                background: guessLat !== null ? 'var(--accent)' : 'var(--paper-400)',
                border: 'none', borderRadius: 9, padding: '10px 20px',
                fontSize: 14, fontWeight: 500,
                color: guessLat !== null ? '#fff' : 'var(--ink-3)',
                cursor: 'pointer',
              }}
            >
              {guessLat !== null ? 'Potvrdit místo ✓' : 'Vyber místo…'}
            </button>
          </div>
        </div>
      )}

      {/* Rozbalený rok */}
      {yearExpanded && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 30,
          background: 'rgba(13,9,6,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div style={{
            width: '100%',
            background: 'var(--paper-50)',
            borderRadius: '20px 20px 0 0',
            padding: '20px 18px',
            paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom) + 16px))',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.35)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 44, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--ink)' }}>
                  {Math.abs(guessYear)}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.14em', color: 'var(--ink-3)', marginTop: 3, textTransform: 'uppercase' }}>
                  {guessYear < 0 ? 'Př. n. l.' : 'N. l.'}
                </div>
              </div>
              <button
                onClick={() => setYearExpanded(false)}
                style={{
                  background: 'var(--paper-200)', border: 'none', borderRadius: 8,
                  padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--ink-2)',
                }}
              >
                ✕ Sbalit
              </button>
            </div>
            <YearPicker value={guessYear} onChange={onYearChange}/>
            <button
              onClick={() => setYearExpanded(false)}
              style={{
                marginTop: 16, width: '100%',
                background: 'var(--accent)', border: 'none', borderRadius: 10,
                padding: '13px 0', fontSize: 15, fontWeight: 500, color: '#fff', cursor: 'pointer',
              }}
            >
              Potvrdit rok ✓
            </button>
          </div>
        </div>
      )}

      {/* Kompaktní UI — 2 dlaždice + odeslat */}
      {!mapExpanded && !yearExpanded && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          zIndex: 20,
          padding: '10px 12px',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {/* 2 dlaždice vedle sebe */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

            {/* Mapa */}
            <button
              onClick={() => setMapExpanded(true)}
              style={{
                display: 'flex', flexDirection: 'column',
                background: 'rgba(245,241,232,0.95)',
                backdropFilter: 'blur(16px)',
                border: `${guessLat !== null ? '3px solid #27ae60' : '1.5px solid rgba(217,119,87,0.35)'}`,
                borderRadius: 14, overflow: 'hidden',
                cursor: 'pointer', padding: 0,
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                height: 100,
                position: 'relative',
              }}
            >
              {/* Živá mini mapa jako pozadí */}
              <div style={{ flex: 1, position: 'relative' }}>
                <GuessMap guessLat={guessLat} guessLng={guessLng} onGuess={onLocationChange} compact/>
              </div>
              {/* Label dole */}
              <div style={{
                padding: '6px 10px',
                background: guessLat !== null ? 'rgba(39,174,96,0.12)' : 'rgba(245,241,232,0.95)',
                borderTop: `0.5px solid ${guessLat !== null ? 'rgba(39,174,96,0.2)' : 'var(--line)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: guessLat !== null ? '#1d6b3a' : 'var(--ink-3)', textTransform: 'uppercase' }}>
                  {guessLat !== null ? 'Místo ✓' : 'Vybrat místo'}
                </span>
                <span style={{ fontSize: 14 }}>{guessLat !== null ? '✓' : '›'}</span>
              </div>
            </button>

            {/* Rok */}
            <button
              onClick={() => setYearExpanded(true)}
              style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                background: 'rgba(245,241,232,0.95)',
                backdropFilter: 'blur(16px)',
                border: `${guessYearSet ? '3px solid #27ae60' : '1.5px solid rgba(217,119,87,0.35)'}`,
                borderRadius: 14,
                cursor: 'pointer', padding: '14px 16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                height: 100, textAlign: 'left',
                gap: 4,
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>Rok</div>
              {guessYearSet ? (
                <>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1 }}>
                    {Math.abs(guessYear)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#1d6b3a' }}>
                      {guessYear < 0 ? 'Př. n. l.' : 'N. l.'} ✓
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 15, color: 'var(--accent-deep)', fontWeight: 500, marginTop: 4 }}>
                  Vybrat rok →
                </div>
              )}
            </button>
          </div>

          {/* Tlačítko odeslat */}
          <button
            style={{
              width: '100%', fontSize: 15, padding: '14px 0',
              borderRadius: 12, border: 'none', fontWeight: 500,
              cursor: canSubmit ? 'pointer' : 'default',
              background: canSubmit ? 'var(--accent)' : 'rgba(245,241,232,0.7)',
              backdropFilter: 'blur(16px)',
              color: canSubmit ? '#fff' : 'var(--ink-3)',
              boxShadow: canSubmit ? '0 4px 20px rgba(217,119,87,0.4)' : 'none',
              transition: 'all 200ms',
            }}
            onClick={() => {
              if (canSubmit) { onSubmit(); return }
              if (missingLocation) { setMapExpanded(true); return }
              if (missingYear) { setYearExpanded(true) }
            }}
          >
            {submitLabel}
          </button>
        </div>
      )}
    </>
  )
}

// ── Year picker — barevný slider + numerický input ───────
function YearPicker({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  const MIN = -3000; const MAX = 2025
  const TOTAL = MAX - MIN  // 5025
  const pct = ((value - MIN) / TOTAL) * 100
  const zeroPct = ((0 - MIN) / TOTAL) * 100  // 59.7%

  function step(d: number) {
    let next = value + d
    if (next === 0) next = d > 0 ? 1 : -1
    onChange(Math.max(MIN, Math.min(MAX, next)))
  }

  function handleInput(raw: string) {
    const n = parseInt(raw)
    if (isNaN(n)) return
    const clamped = Math.max(MIN, Math.min(MAX, n))
    onChange(clamped === 0 ? -1 : clamped)
  }

  const thumbColor = value < 0 ? '#7aa8cc' : '#d97757'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Barevný slider */}
      <div>
        <div style={{ position: 'relative', height: 28, marginBottom: 4 }}>
          {/* Pozadí stopy */}
          <div style={{ position: 'absolute', top: 11, left: 0, right: 0, height: 6, borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${zeroPct}%`, background: 'linear-gradient(90deg, #5a8fb5, #9bbdd4)' }}/>
            <div style={{ flex: 1, background: 'linear-gradient(90deg, #e8b49a, #d97757)' }}/>
          </div>
          {/* Nulová svislá čára */}
          <div style={{
            position: 'absolute', top: 5, left: `${zeroPct}%`,
            width: 2, height: 18,
            background: 'rgba(42,31,23,0.3)',
            transform: 'translateX(-50%)',
            borderRadius: 1,
            pointerEvents: 'none',
          }}/>
          {/* Custom thumb */}
          <div style={{
            position: 'absolute', top: 4,
            left: `${pct}%`,
            transform: 'translateX(-50%)',
            width: 20, height: 20, borderRadius: '50%',
            background: 'var(--paper-50)',
            border: `2.5px solid ${thumbColor}`,
            boxShadow: `0 0 0 3px ${value < 0 ? 'rgba(90,143,181,0.2)' : 'rgba(217,119,87,0.2)'}`,
            pointerEvents: 'none',
            transition: 'border-color 200ms',
          }}/>
          {/* Invisible range input */}
          <input
            type="range" min={MIN} max={MAX} value={value}
            step={1}
            onChange={e => {
              let v = parseInt(e.target.value)
              if (v === 0) v = -1
              onChange(v)
            }}
            style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', margin: 0, height: 28 }}
          />
        </div>
        {/* Popisky */}
        <div style={{ position: 'relative', height: 16 }}>
          <span style={{ position: 'absolute', left: 0, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#7aa8cc' }}>3000 př.</span>
          <span style={{ position: 'absolute', left: `${zeroPct}%`, transform: 'translateX(-50%)', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>0</span>
          <span style={{ position: 'absolute', right: 0, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#d97757' }}>2025</span>
        </div>
      </div>

      {/* Krokovací tlačítka */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {([-10, -1, 1, 10] as const).map(d => (
          <button
            key={d}
            onClick={() => step(d)}
            style={{
              padding: '12px 0',
              borderRadius: 9,
              border: '0.5px solid var(--line-strong)',
              background: 'var(--paper-100)',
              fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 500,
              color: 'var(--ink)',
              cursor: 'pointer',
              transition: 'background 100ms',
            }}
          >
            {d > 0 ? `+${d}` : d}
          </button>
        ))}
      </div>

      {/* Přesný input */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>
          Zadat přesný rok (− = př. n. l.)
        </div>
        <input
          type="text"
          inputMode="decimal"
          pattern="-?[0-9]*"
          min={MIN} max={MAX}
          value={value === 0 ? '' : String(value)}
          onChange={e => handleInput(e.target.value)}
          placeholder="-480 nebo 1912"
          style={{
            width: '100%', textAlign: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 18,
            padding: '11px 14px',
            border: '1px solid var(--line-strong)',
            borderRadius: 10,
            color: 'var(--ink)', background: 'var(--surface)',
            outline: 'none',
          }}
        />
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
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
        }}>
          {/* Header — název + skóre */}
          <div style={{ padding: '12px 14px 10px', borderBottom: '0.5px solid var(--line)', flexShrink: 0 }}>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 3 }}>Výsledek kola</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, letterSpacing: '-0.01em', flex: 1, lineHeight: 1.2 }}>{event.title}</div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--accent)', letterSpacing: '-0.03em', lineHeight: 1 }}>{round.round_score.toLocaleString('cs-CZ')}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>z 10 000</div>
              </div>
            </div>
          </div>

          {/* Tab přepínač */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '0.5px solid var(--line)', flexShrink: 0 }}>
            {([['score', '🏆', 'Skóre'], ['info', '📖', 'O události']] as const).map(([key, icon, label]) => (
              <button key={key} onClick={() => setTab(key)}
                style={{ padding: '9px 0', border: 'none', borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', fontSize: 12, fontWeight: tab === key ? 600 : 400, color: tab === key ? 'var(--accent)' : 'var(--ink-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <span style={{ fontSize: 13 }}>{icon}</span>{label}
              </button>
            ))}
          </div>

          {/* Obsah — bez scrollu, pevné výšky */}
          {tab === 'score' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Mapa — pevná výška s overflow:hidden aby nepřetékala */}
              <div style={{ height: 120, flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                <ResultMap guessLat={round.guess_lat} guessLng={round.guess_lng} truthLat={event.lat} truthLng={event.lng} radiusKm={event.location_radius_km ?? 0}/>
              </div>
              {/* Skóre karty */}
              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <ScoreCard label="Poloha" score={round.location_score} pct={locPct} sub={formatDistance(round.distance_km)}/>
                  <ScoreCard label="Rok" score={round.year_score} pct={yrPct} sub={yearDiffLabel} highlight={round.year_diff === 0}/>
                </div>
                <div style={{ background: 'var(--paper-200)', borderRadius: 9, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div className="eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>Správný rok</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500 }}>{formatYear(event.year)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>Tvůj tip</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500 }}>{formatYear(round.guess_year)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'info' && (
            <div style={{ maxHeight: '45dvh', overflowY: 'auto' }}>
              <InfoContent event={event}/>
            </div>
          )}

          {/* Tlačítko dole */}
          <div style={{ padding: `10px 14px`, paddingBottom: 'max(12px, env(safe-area-inset-bottom))', borderTop: '0.5px solid var(--line)', flexShrink: 0 }}>
            {nextBtn}
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
