import { useEffect, useRef, useState } from 'react'
import { ResultMap } from '@/components/GameMap'
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

// ── Guess panel ───────────────────────────────────────────
function GuessPanel({ guessLat, guessLng, guessYear, canSubmit, onLocationChange, onYearChange, onSubmit }: {
  guessLat: number | null; guessLng: number | null; guessYear: number
  canSubmit: boolean; onLocationChange: (lat: number, lng: number) => void
  onYearChange: (y: number) => void; onSubmit: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState<'map' | 'year'>('map')

  if (collapsed) {
    return (
      <div
        onClick={() => setCollapsed(false)}
        style={{
          position: 'absolute', bottom: 20, right: 16,
          background: 'rgba(245,241,232,0.97)',
          borderRadius: 12, padding: '10px 18px',
          border: '1px solid var(--line)',
          boxShadow: 'var(--shadow-lg)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
        }}
      >
        <span className="eyebrow" style={{ fontSize: 10 }}>TVŮJ TIP</span>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>▼</span>
      </div>
    )
  }

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'rgba(245,241,232,0.98)',
      backdropFilter: 'blur(16px)',
      borderTop: '1px solid var(--line)',
      borderRadius: '18px 18px 0 0',
      boxShadow: '0 -8px 32px rgba(42,31,23,0.12)',
      maxWidth: 'min(510px, 100%)',
      marginLeft: 'auto',
    }}>
      {/* Header s tab přepínačem */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px 0', gap: 8 }}>
        <span className="eyebrow" style={{ fontSize: 10, flex: 1 }}>TVŮJ TIP</span>
        {/* Tab přepínač */}
        <div style={{ display: 'flex', background: 'var(--paper-200)', borderRadius: 8, padding: 3, gap: 3 }}>
          <TabBtn active={tab === 'map'} onClick={() => setTab('map')}>🗺 Mapa</TabBtn>
          <TabBtn active={tab === 'year'} onClick={() => setTab('year')}>📅 Rok</TabBtn>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 18, padding: '0 0 0 8px', lineHeight: 1 }}
        >
          ▼
        </button>
      </div>

      <div style={{ padding: '12px 16px 16px' }} className="game-panel-bottom">
        {/* Mapa tab — vždy v DOM, jen skrytá přes display */}
        <div style={{ display: tab === 'map' ? 'flex' : 'none', flexDirection: 'column', gap: 8 }}>
          <SVGWorldMap guessLat={guessLat} guessLng={guessLng} onGuess={onLocationChange}/>
          {guessLat !== null && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', textAlign: 'center' }}>
              {guessLat.toFixed(2)}° {guessLat >= 0 ? 'N' : 'S'} · {guessLng?.toFixed(2)}° {guessLng! >= 0 ? 'E' : 'W'}
            </div>
          )}
          <button
            className="btn btn-ghost"
            style={{ width: '100%', fontSize: 13 }}
            onClick={() => setTab('year')}
          >
            Dále: zadat rok →
          </button>
        </div>

        {/* Rok tab */}
        <div style={{ display: tab === 'year' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
          <YearPicker value={guessYear} onChange={onYearChange}/>
          <button
            className="btn btn-accent"
            style={{ width: '100%', fontSize: 15, padding: '14px 0' }}
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            Odeslat odpověď →
          </button>
          {!canSubmit && (
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>
              ← Nejdřív vyber místo na mapě
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 6,
        border: 'none',
        background: active ? 'var(--surface)' : 'transparent',
        boxShadow: active ? 'var(--shadow-sm)' : 'none',
        fontSize: 12, fontWeight: 500,
        color: active ? 'var(--ink)' : 'var(--ink-3)',
        cursor: 'pointer',
        transition: 'all 150ms',
      }}
    >
      {children}
    </button>
  )
}


// ── SVG světová mapa pro tipování (bez Leaflet) ───────────
function SVGWorldMap({ onGuess, guessLat, guessLng }: {
  onGuess: (lat: number, lng: number) => void
  guessLat: number | null
  guessLng: number | null
}) {
  const svgRef = useRef<SVGSVGElement>(null)

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const lat = 90 - y * 180
    const lng = x * 360 - 180
    onGuess(lat, lng)
  }

  const pinX = guessLng !== null ? ((guessLng + 180) / 360) * 100 : null
  const pinY = guessLat !== null ? ((90 - guessLat) / 180) * 100 : null

  return (
    <div style={{ position: 'relative', width: '100%', height: 240, borderRadius: 10, border: '1px solid var(--line)', overflow: 'hidden', cursor: 'crosshair' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 1000 500"
        width="100%"
        height="100%"
        style={{ display: 'block', background: '#a8c8d8' }}
        onClick={handleClick}
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Oceány */}
        <rect width="1000" height="500" fill="#a8c8d8"/>
        {/* Mřížka */}
        {[0,100,200,300,400,500,600,700,800,900,1000].map(x => (
          <line key={`v${x}`} x1={x} y1={0} x2={x} y2={500} stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
        ))}
        {[0,100,200,300,400,500].map(y => (
          <line key={`h${y}`} x1={0} y1={y} x2={1000} y2={y} stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
        ))}
        {/* Rovník */}
        <line x1={0} y1={250} x2={1000} y2={250} stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="8,4"/>

        {/* ── Kontinenty (zjednodušené ale rozpoznatelné) ── */}
        {/* Severní Amerika */}
        <path d="M80,60 L180,50 L220,80 L240,140 L220,200 L180,220 L140,230 L100,200 L60,160 L50,100 Z" fill="#c9b99a" stroke="#b8a888" strokeWidth="1"/>
        {/* Střední Amerika */}
        <path d="M180,220 L200,250 L190,270 L170,260 L160,240 Z" fill="#c9b99a" stroke="#b8a888" strokeWidth="1"/>
        {/* Jižní Amerika */}
        <path d="M180,270 L230,260 L270,290 L280,360 L250,430 L210,450 L180,420 L160,360 L150,300 Z" fill="#c9b99a" stroke="#b8a888" strokeWidth="1"/>
        {/* Grónsko */}
        <path d="M240,20 L300,15 L320,40 L300,60 L260,55 Z" fill="#c9b99a" stroke="#b8a888" strokeWidth="1"/>
        {/* Evropa */}
        <path d="M440,60 L510,50 L540,70 L530,110 L500,130 L460,125 L440,100 Z" fill="#c9b99a" stroke="#b8a888" strokeWidth="1"/>
        {/* Skandinávie */}
        <path d="M470,30 L510,25 L520,55 L490,65 L460,55 Z" fill="#c9b99a" stroke="#b8a888" strokeWidth="1"/>
        {/* Britské ostrovy */}
        <path d="M425,65 L445,60 L448,80 L430,85 Z" fill="#c9b99a" stroke="#b8a888" strokeWidth="1"/>
        {/* Afrika */}
        <path d="M445,130 L520,125 L550,160 L560,240 L540,320 L510,370 L480,375 L450,340 L430,260 L420,180 Z" fill="#c9b99a" stroke="#b8a888" strokeWidth="1"/>
        {/* Madagaskar */}
        <path d="M565,290 L575,280 L580,310 L570,325 Z" fill="#c9b99a" stroke="#b8a888" strokeWidth="1"/>
        {/* Asie - západ + střed */}
        <path d="M540,50 L700,40 L750,70 L740,130 L700,150 L640,155 L580,140 L550,110 Z" fill="#c9b99a" stroke="#b8a888" strokeWidth="1"/>
        {/* Asie - východ */}
        <path d="M700,40 L820,45 L850,90 L840,150 L790,170 L740,160 L740,130 L750,70 Z" fill="#c9b99a" stroke="#b8a888" strokeWidth="1"/>
        {/* Indie */}
        <path d="M620,150 L660,145 L670,200 L645,230 L620,210 L605,175 Z" fill="#c9b99a" stroke="#b8a888" strokeWidth="1"/>
        {/* Jihovýchodní Asie */}
        <path d="M760,160 L820,155 L830,190 L800,200 L765,185 Z" fill="#c9b99a" stroke="#b8a888" strokeWidth="1"/>
        {/* Japonsko */}
        <path d="M845,90 L860,85 L865,110 L850,115 Z" fill="#c9b99a" stroke="#b8a888" strokeWidth="1"/>
        {/* Austrálie */}
        <path d="M760,290 L860,285 L890,320 L880,380 L840,400 L790,395 L755,360 L745,320 Z" fill="#c9b99a" stroke="#b8a888" strokeWidth="1"/>
        {/* Nový Zéland */}
        <path d="M900,360 L910,350 L915,375 L905,385 Z" fill="#c9b99a" stroke="#b8a888" strokeWidth="1"/>
        {/* Rusko - Sibiř */}
        <path d="M540,30 L820,20 L850,45 L820,45 L700,40 L540,50 Z" fill="#c9b99a" stroke="#b8a888" strokeWidth="1"/>

        {/* Pin hráče */}
        {pinX !== null && pinY !== null && (
          <g transform={`translate(${pinX * 10}, ${pinY * 5})`}>
            <path d="M0,-18 C-7,-18 -12,-12 -12,-5 C-12,4 0,18 0,18 C0,18 12,4 12,-5 C12,-12 7,-18 0,-18 Z"
              fill="#d97757" stroke="#b85a3e" strokeWidth="1"/>
            <circle cy="-5" r="4" fill="white"/>
          </g>
        )}
      </svg>

      {/* Hint */}
      {guessLat === null && (
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em',
          color: 'var(--ink-3)', background: 'rgba(245,241,232,0.92)',
          padding: '3px 12px', borderRadius: 999, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          KLIKNI PRO UMÍSTĚNÍ PINU
        </div>
      )}

      {/* Souřadnice */}
      {guessLat !== null && (
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)',
          background: 'rgba(245,241,232,0.92)', padding: '3px 10px', borderRadius: 999,
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          {guessLat.toFixed(1)}° {guessLat >= 0 ? 'N' : 'S'} · {guessLng?.toFixed(1)}° {guessLng! >= 0 ? 'E' : 'W'}
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
