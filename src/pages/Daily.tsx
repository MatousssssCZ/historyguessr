import { useEffect, useState, useRef, useCallback } from 'react'
import { currentLocale } from '@/i18n'
import { useTranslation } from 'react-i18next'
import { eventTitle, eventDescription } from '@/lib/eventLocale'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  getDailyChallenge, getTodayDailyResult,
  saveDailyResult, getDailyFriendsLeaderboard, getDailyAllScores, recordEventScore, recordCategoryHit, track,
} from '@/lib/supabase'
import { haversineKm, roundScore, yearDiff, formatYear } from '@/lib/scoring'
import { XP_BONUS_DAILY } from '@/lib/leveling'
import BackButton from '@/components/BackButton'
import GameEvaluation from '@/components/GameEvaluation'
import ControlDock from '@/components/GameControls'
import type { Event } from '@/types/database'
import type { DailyResult } from '@/lib/supabase'
import { GuessMap, ResultMap } from '@/components/GameMap'

declare const pannellum: {
  viewer: (container: HTMLElement, config: Record<string, unknown>) => { destroy: () => void }
}

const TIMER_SECONDS = 60

type Phase = 'loading' | 'no_challenge' | 'already_played' | 'warning' | 'playing' | 'result'

export default function DailyChallengePage() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<Phase>('loading')
  const [event, setEvent] = useState<Event | null>(null)
  const [leaderboard, setLeaderboard] = useState<DailyResult[]>([])
  const [allScores, setAllScores] = useState<number[]>([])
  const [panoramaReady, setPanoramaReady] = useState(false)

  // Guess state
  const [guessLat, setGuessLat] = useState<number | null>(null)
  const [guessLng, setGuessLng] = useState<number | null>(null)
  const [guessYear, setGuessYear] = useState(0)
  const [guessYearSet, setGuessYearSet] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [yearExpanded, setYearExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Timer
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasSubmittedRef = useRef(false)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  // Result state
  const [result, setResult] = useState<{
    distKm: number; locScore: number; yrScore: number; totalScore: number; yrDiff: number; xpMult: number
  } | null>(null)
  const timeLeftRef = useRef(TIMER_SECONDS)
  // Vždy ukazuje na AKTUÁLNÍ doSubmit (časovač jinak volá zastaralou closure s prázdným tipem)
  const doSubmitRef = useRef<(fl?: number | null, fln?: number | null, fy?: number) => void>(() => {})

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  async function load() {
    setPhase('loading')
    const [ev, existing, lb, scores] = await Promise.all([
      getDailyChallenge(),
      getTodayDailyResult(user!.id),
      getDailyFriendsLeaderboard(user!.id, profile?.username ?? null),
      getDailyAllScores(),
    ])
    setLeaderboard(lb)
    setAllScores(scores)

    if (!ev) { setPhase('no_challenge'); return }
    setEvent(ev)

    if (existing) {
      // Rekonstruuj výsledek
      if (existing.guess_lat != null && existing.guess_lng != null && existing.guess_year != null) {
        const dist = haversineKm(existing.guess_lat, existing.guess_lng, ev.lat, ev.lng)
        const yf = ev.year_from ?? ev.year; const yt = ev.year_to ?? ev.year
        const { location_score: locSc, year_score: yrSc } = roundScore(dist, existing.guess_year, yf, yt, ev.location_radius_km ?? 0)
        setGuessLat(existing.guess_lat); setGuessLng(existing.guess_lng); setGuessYear(existing.guess_year)
        setResult({ distKm: dist, locScore: locSc, yrScore: yrSc, totalScore: existing.score, yrDiff: yearDiff(existing.guess_year, yf, yt), xpMult: 1 })
      }
      setPhase('already_played')
      return
    }

    // Preload panoramy na pozadí během warning screenu
    if (ev.panorama_url && ev.panorama_url !== 'pending') {
      const link = document.createElement('link')
      link.rel = 'preload'; link.as = 'image'
      link.href = ev.panorama_url; link.crossOrigin = 'anonymous'
      link.onload = () => setPanoramaReady(true)
      document.head.appendChild(link)
      setTimeout(() => setPanoramaReady(true), 5000) // fallback
    }

    setPhase('warning')
  }

  // Spuštění hry po potvrzení
  function startGame() {
    hasSubmittedRef.current = false
    setTimeLeft(TIMER_SECONDS)
    setPhase('playing')
    track('daily_challenge_started', {}, user?.id)

    // Spusť timer
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          timeLeftRef.current = 0
          // Auto-submit při vypršení — přes ref, ať se použije aktuální tip
          if (!hasSubmittedRef.current) doSubmitRef.current()
          return 0
        }
        timeLeftRef.current = t - 1
        return t - 1
      })
    }, 1000)
  }

  // Detekce odchodu ze hry — zaznamenat jako played (score 0)
  useEffect(() => {
    if (phase !== 'playing') return
    const handleUnload = () => {
      if (!hasSubmittedRef.current && user && event) {
        // Synchronní beacon — při unloadu
        navigator.sendBeacon?.('/api/noop') // jen wake-up, skutečné uložení níž
        saveDailyResult(user.id, 0, 0, 0, 0)
      }
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [phase, user, event])

  // Cleanup timeru při unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const doSubmit = useCallback(async (forceLat?: number | null, forceLng?: number | null, forceYear?: number) => {
    if (!event || !user || hasSubmittedRef.current) return
    hasSubmittedRef.current = true
    if (timerRef.current) clearInterval(timerRef.current)
    setSubmitting(true)

    const lat = forceLat !== undefined ? forceLat : guessLat
    const lng = forceLng !== undefined ? forceLng : guessLng
    const year = forceYear !== undefined ? forceYear : guessYear

    const yf = event.year_from ?? event.year; const yt = event.year_to ?? event.year
    const dist = lat != null && lng != null ? haversineKm(lat, lng, event.lat, event.lng) : 20000
    const yrDiff_ = yearDiff(year, yf, yt)
    const { location_score: locSc, year_score: yrSc, round_score: total } = roundScore(dist, year, yf, yt, event.location_radius_km ?? 0)

    // XP násobič z zbylého času: čas/10, jen když zbývá ≥ 10 s (jinak 1×)
    const remain = timeLeftRef.current
    const xpMult = remain >= 10 ? remain / 10 : 1

    if (lat != null) setGuessLat(lat)
    if (lng != null) setGuessLng(lng)
    setGuessYear(year)
    setResult({ distKm: dist, locScore: locSc, yrScore: yrSc, totalScore: total, yrDiff: yrDiff_, xpMult })

    recordEventScore(event.id, locSc, yrSc)
    recordCategoryHit(event.id, total)
    await saveDailyResult(user.id, total, lat ?? 0, lng ?? 0, year, xpMult)
    const [lb, scores] = await Promise.all([
      getDailyFriendsLeaderboard(user.id, profile?.username ?? null),
      getDailyAllScores(),
    ])
    setLeaderboard(lb)
    setAllScores(scores)
    setSubmitting(false)
    setPhase('result')
  }, [event, user, guessLat, guessLng, guessYear, profile?.username])

  useEffect(() => { doSubmitRef.current = doSubmit }, [doSubmit])

  async function handleSubmit() {
    await doSubmit()
  }

  const canSubmit = guessLat !== null && guessYearSet
  const timerPct = (timeLeft / TIMER_SECONDS) * 100
  const timerColor = timeLeft > 20 ? '#d97757' : '#c0392b'

  // ── Loading ─────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sepia-900)' }}>
        <span className="spinner" style={{ width: 28, height: 28, borderTopColor: 'var(--accent)' }}/>
      </div>
    )
  }

  // ── Žádná výzva ─────────────────────────────────────────
  if (phase === 'no_challenge') {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--sepia-900)', gap: 16, padding: 24 }}>
        <div style={{ fontSize: 48 }}>📅</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--on-dark)', margin: 0, textAlign: 'center' }}>
          {t('daily.noChallenge')}
        </h1>
        <p style={{ color: 'rgba(245,241,232,0.5)', fontSize: 15, textAlign: 'center', margin: 0 }}>
          {t('daily.tryTomorrow')}
        </p>
        <div style={{ marginTop: 8 }}>
          <BackButton tone="dark" onClick={() => navigate('/menu')} label={t('daily.menu')} />
        </div>
      </div>
    )
  }

  // ── Výsledky (already_played nebo po odeslání) ──────────
  if ((phase === 'result' || phase === 'already_played') && event && result) {
    return (
      <DailyResultScreen
        event={event}
        result={result}
        guessLat={guessLat ?? 0}
        guessLng={guessLng ?? 0}
        guessYear={guessYear}
        leaderboard={leaderboard}
        allScores={allScores}
        userId={user?.id}
        alreadyPlayed={phase === 'already_played'}
        onMenu={() => navigate('/menu')}
      />
    )
  }

  // ── Warning screen ──────────────────────────────────────
  if (phase === 'warning' && event) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--sepia-900)', position: 'relative', overflow: 'hidden' }}>
        {/* Dekorativní pozadí */}
        <svg style={{ position: 'absolute', inset: 0, opacity: 0.04, pointerEvents: 'none' }} width="100%" height="100%">
          <defs><pattern id="dg" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f5f1e8" strokeWidth="0.5"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#dg)"/>
        </svg>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'calc(env(safe-area-inset-top,0px) + 24px) 24px 24px', position: 'relative', maxWidth: 480, margin: '0 auto', width: '100%' }}>

          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(217,119,87,0.12)', border: '1px solid rgba(217,119,87,0.25)', borderRadius: 999, padding: '6px 16px', marginBottom: 20, alignSelf: 'flex-start' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', color: 'var(--accent)', textTransform: 'uppercase' }}>
              {t('menu.dailyMobile')}
            </span>
          </div>

          {/* Název události */}
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px, 6vw, 36px)', color: 'var(--on-dark)', margin: '0 0 28px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {eventTitle(event)}
          </h1>

          {/* Pravidla */}
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px 20px', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <RuleRow icon="⏱" text={t('daily.rule1')}/>
            <RuleRow icon="⚠" text={t('daily.rule2')}/>
            <RuleRow icon="🏆" text={t('daily.rule3')}/>
          </div>

          {/* Indikátor načítání panoramy */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            {panoramaReady ? (
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#27ae60', flexShrink: 0 }}/>
            ) : (
              <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5, borderTopColor: 'var(--accent)', flexShrink: 0 }}/>
            )}
            <span style={{ fontSize: 12, color: 'rgba(245,241,232,0.4)', fontFamily: 'var(--font-mono)' }}>
              {panoramaReady ? t('daily.panoramaReady') : t('daily.panoramaLoading')}
            </span>
          </div>

          {/* Tlačítka */}
          <div style={{ display: 'flex', gap: 10 }}>
            <BackButton tone="dark" onClick={() => navigate('/menu')} label={t('daily.menu')} />
            <button
              className="btn btn-accent"
              style={{ flex: 1, fontSize: 15, padding: '12px 20px' }}
              onClick={startGame}
            >
              {t('daily.start')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Hra s časovačem ─────────────────────────────────────
  if (phase === 'playing' && event) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0d0906', position: 'relative', overflow: 'hidden' }}>

        {/* Tenký proužek času nahoře */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'rgba(0,0,0,0.18)', zIndex: 26 }}>
          <div style={{ height: '100%', width: `${timerPct}%`, background: timerColor, transition: 'width 1s linear, background 500ms' }}/>
        </div>

        {/* Plovoucí skleněný HUD */}
        <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top,0px) + 12px)', left: 0, right: 0, zIndex: 25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0 14px', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', minWidth: 0, maxWidth: '58%', borderRadius: 16, padding: '6px 14px', background: 'rgba(246,240,230,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.5)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.12em', color: 'var(--accent-deep)', textTransform: 'uppercase' }}>{t('menu.dailyMobile')}</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: '#26211C', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eventTitle(event)}</div>
          </div>
          <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 6, height: 38, borderRadius: 20, padding: '0 14px', background: 'rgba(246,240,230,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: timerColor, transition: 'color 500ms' }}>
            ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
        </div>

        {/* Panorama — celá plocha */}
        <div style={{ flex: 1, position: 'relative' }}>
          <PanoramaViewer url={event.panorama_url}/>
        </div>

        {/* Ovládací dock (dle #1b) */}
        {!mapExpanded && !yearExpanded && (
          <ControlDock set={guessLat !== null} guessYear={guessYear} guessYearSet={guessYearSet}
            canSubmit={!!canSubmit} submitLabel={submitting ? t('daily.submitting') : t('game.submit')} submitting={submitting}
            onMap={() => setMapExpanded(true)} onYear={() => setYearExpanded(true)} onSubmit={handleSubmit}/>
        )}

        {/* Rozbalená mapa */}
        {mapExpanded && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <GuessMap guessLat={guessLat} guessLng={guessLng} onGuess={(lat, lng) => { setGuessLat(lat); setGuessLng(lng) }}/>
              <button onClick={() => setMapExpanded(false)} aria-label={t('daily.collapse')} style={{ position: 'absolute', top: 'calc(10px + env(safe-area-inset-top,0px))', right: 10, zIndex: 10, width: 40, height: 40, borderRadius: '50%', background: 'rgba(13,9,6,0.72)', backdropFilter: 'blur(8px)', border: '1px solid rgba(245,241,232,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, lineHeight: 1, color: 'rgba(245,241,232,0.95)', cursor: 'pointer' }}>×</button>
              {/* Timer v rozbalené mapě */}
              <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(13,9,6,0.7)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: '6px 12px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: timerColor, fontWeight: 600 }}>
                  {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                </span>
              </div>
            </div>
            <div style={{ background: 'rgba(245,241,232,0.97)', padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: '0.5px solid var(--line)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                {guessLat !== null ? `${guessLat.toFixed(1)}° · ${guessLng?.toFixed(1)}° ✓` : t('game.clickMap')}
              </span>
              <button onClick={() => setMapExpanded(false)} style={{ background: guessLat !== null ? 'var(--accent)' : 'var(--paper-400)', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 14, fontWeight: 500, color: guessLat !== null ? '#fff' : 'var(--ink-3)', cursor: 'pointer' }}>
                {guessLat !== null ? t('game.confirmPlace') : t('game.pickPlace')}
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
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 44, letterSpacing: '-0.03em', lineHeight: 1 }}>{Math.abs(guessYear) || '?'}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.14em', color: 'var(--ink-3)', marginTop: 3, textTransform: 'uppercase' }}>{guessYear < 0 ? t('daily.bc') : 'N. l.'}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: timerColor, fontWeight: 600 }}>
                    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                  </div>
                  <button onClick={() => setYearExpanded(false)} style={{ background: 'var(--paper-200)', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--ink-2)' }}>{t('daily.collapse')}</button>
                </div>
              </div>
              <YearPickerInline value={guessYear} onChange={(y) => { setGuessYear(y); setGuessYearSet(true) }}/>
              <button onClick={() => setYearExpanded(false)} style={{ marginTop: 16, width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '13px 0', fontSize: 15, fontWeight: 500, color: '#fff', cursor: 'pointer' }}>
                {t('game.confirmYear')}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}

// ── Rule row ─────────────────────────────────────────────
function RuleRow({ icon, text }: { icon: string; text: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span style={{ fontSize: 14, color: 'rgba(245,241,232,0.55)', lineHeight: 1.5 }}>{text}</span>
    </div>
  )
}

// ── Panorama viewer ───────────────────────────────────────
function PanoramaViewer({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current || !url || url === 'pending') return
    let v: { destroy: () => void } | null = null
    try {
      v = pannellum.viewer(ref.current, { type: 'equirectangular', panorama: url, autoLoad: true, showControls: false, hfov: 140, maxHfov: 140 })
    } catch {}
    return () => { v?.destroy() }
  }, [url])
  return <div ref={ref} style={{ width: '100%', height: '100%' }}/>
}

// ── Year picker ───────────────────────────────────────────
function YearPickerInline({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  const { t } = useTranslation()
  const MIN = -3000, MAX = 2025, TOTAL = MAX - MIN
  const pct = ((value - MIN) / TOTAL) * 100
  const zeroPct = ((0 - MIN) / TOTAL) * 100
  function step(d: number) { let n = value + d; if (n === 0) n = d > 0 ? 1 : -1; onChange(Math.max(MIN, Math.min(MAX, n))) }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ position: 'relative', height: 48, marginBottom: 4, touchAction: 'none' }}>
        <div style={{ position: 'absolute', top: 21, left: 0, right: 0, height: 6, borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${zeroPct}%`, background: 'linear-gradient(90deg,#5a8fb5,#9bbdd4)' }}/>
          <div style={{ flex: 1, background: 'linear-gradient(90deg,#e8b49a,#d97757)' }}/>
        </div>
        <div style={{ position: 'absolute', top: 15, left: `${zeroPct}%`, width: 2, height: 18, background: 'rgba(42,31,23,0.3)', transform: 'translateX(-50%)', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', top: 9, left: `${pct}%`, transform: 'translateX(-50%)', width: 30, height: 30, borderRadius: '50%', background: 'var(--paper-50)', border: `3px solid ${value < 0 ? '#7aa8cc' : '#d97757'}`, boxShadow: `0 0 0 4px ${value < 0 ? 'rgba(90,143,181,0.2)' : 'rgba(217,119,87,0.2)'}`, pointerEvents: 'none' }}/>
        <input type="range" min={MIN} max={MAX} value={value} step={1} onChange={e => { let v = parseInt(e.target.value); if (v === 0) v = -1; onChange(v) }} style={{ position: 'absolute', inset: 0, width: '100%', height: 48, opacity: 0, cursor: 'pointer', margin: 0, touchAction: 'none' }}/>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
        <span style={{ color: '#7aa8cc' }}>{t('game.bcAxis')}</span>
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
      <input type="text" inputMode="decimal" pattern="-?[0-9]*" value={value === 0 ? '' : String(value)}
        onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n) && n !== 0) onChange(Math.max(MIN, Math.min(MAX, n))) }}
        placeholder={t('daily.yearPlaceholder')}
        style={{ width: '100%', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 18, padding: '11px 14px', border: '1px solid var(--line-strong)', borderRadius: 10, color: 'var(--ink)', background: 'var(--surface)', outline: 'none' }}
      />
    </div>
  )
}

// ── Histogram ─────────────────────────────────────────────
function ScoreHistogram({ scores, myScore }: { scores: number[]; myScore: number }) {
  const BINS = 20
  const bins = Array(BINS).fill(0)
  scores.forEach(s => {
    const idx = Math.min(BINS - 1, Math.floor((s / 1000) * BINS))
    bins[idx]++
  })
  const max = Math.max(...bins, 1)
  const myBin = Math.min(BINS - 1, Math.floor((myScore / 1000) * BINS))
  const rank = scores.filter(s => s > myScore).length + 1
  const pct = Math.round((rank / Math.max(scores.length, 1)) * 100)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64 }}>
        {bins.map((v, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', position: 'relative' }}>
            {i === myBin && (
              <div style={{ position: 'absolute', bottom: '100%', marginBottom: 3, fontFamily: 'var(--font-mono)', fontSize: 9, color: '#d97757', whiteSpace: 'nowrap' }}>ty</div>
            )}
            <div style={{ width: '100%', background: i === myBin ? '#d97757' : 'var(--line-strong)', borderRadius: '2px 2px 0 0', height: `${Math.max(4, (v / max) * 56)}px` }}/>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        {['0', '250', '500', '750', '1 000'].map(l => (
          <span key={l} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)' }}>{l}</span>
        ))}
      </div>
      <p style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)', margin: '8px 0 0' }}>
        Top {pct}% z {scores.length} hráčů
      </p>
    </div>
  )
}

// ── Výsledková obrazovka ──────────────────────────────────
function DailyResultScreen({ event, result, guessLat, guessLng, guessYear, leaderboard, allScores, userId, alreadyPlayed, onMenu }: {
  event: Event; result: { distKm: number; locScore: number; yrScore: number; totalScore: number; yrDiff: number; xpMult: number }
  guessLat: number; guessLng: number; guessYear: number
  leaderboard: DailyResult[]; allScores: number[]; userId?: string; alreadyPlayed: boolean; onMenu: () => void
}) {
  const { t } = useTranslation()
  const [histModal, setHistModal] = useState(false)
  const [tab, setTab] = useState<'score' | 'info'>('score')
  const isMobile = window.innerWidth < 768
  const locPct = Math.round(result.locScore / 5)
  const yrPct = Math.round(result.yrScore / 5)
  const myRank = leaderboard.filter(r => r.score > result.totalScore).length + 1

  const scoreSection = (
    <>
      {/* Mapa */}
      <div style={{ height: isMobile ? 130 : 180, flexShrink: 0, overflow: 'hidden' }}>
        <ResultMap guessLat={guessLat} guessLng={guessLng} truthLat={event.lat} truthLng={event.lng} radiusKm={event.location_radius_km ?? 0}/>
      </div>
      {/* Skóre karty */}
      <div style={{ padding: isMobile ? '10px 12px' : '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <ScoreCard label={t('game.location')} score={result.locScore} pct={locPct} sub={result.distKm < 1 ? '<1 km' : `${Math.round(result.distKm).toLocaleString(currentLocale())} km`}/>
          <ScoreCard label={t('game.year')} score={result.yrScore} pct={yrPct} sub={result.yrDiff === 0 ? t('daily.exact') : t('game.yearOff', { n: result.yrDiff })} highlight={result.yrDiff === 0}/>
        </div>
        <div style={{ background: 'var(--paper-200)', borderRadius: 9, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>{t('game.correctYear')}</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500 }}>{formatYear(event.year)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>{t('game.yourGuess')}</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500 }}>{formatYear(guessYear)}</div>
          </div>
        </div>
      </div>
    </>
  )

  const infoSection = (
    <div style={{ padding: isMobile ? '12px 14px 14px' : '16px 20px 18px' }}>
      {event.event_image_url && (
        <img src={event.event_image_url} alt={eventTitle(event)} loading="lazy" style={{ width: '100%', borderRadius: 12, border: '0.5px solid var(--line)', marginBottom: 14, display: 'block', maxHeight: isMobile ? 220 : 280, objectFit: 'cover' }}/>
      )}
      <p style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink-2)', margin: 0 }}>{eventDescription(event)}</p>
    </div>
  )

  const resultTabs = (
    <div style={{ display: 'flex', gap: 8, padding: isMobile ? '10px 12px 2px' : '12px 20px 4px', flexShrink: 0 }}>
      {(['score', 'info'] as const).map(k => {
        const active = tab === k
        return (
          <button key={k} type="button" onClick={() => setTab(k)} style={{
            flex: 1, padding: '9px 0', borderRadius: 10, cursor: 'pointer',
            border: active ? '1px solid var(--accent)' : '1px solid var(--line)',
            background: active ? 'rgba(217,119,87,0.08)' : 'transparent',
            color: active ? 'var(--accent-deep)' : 'var(--ink-3)',
            fontSize: 13, fontWeight: active ? 500 : 400,
            fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
          }}>
            {k === 'score' ? `🏆 ${t('game.tabScore')}` : `📖 ${t('game.tabInfo')}`}
          </button>
        )
      })}
    </div>
  )

  const leaderboardSection = (
    <div style={{ padding: isMobile ? '0 12px 8px' : '18px 20px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: 0 }}>{t('daily.leaderboard')}</p>
        {leaderboard.length > 0 && (
          <span style={{ background: 'rgba(217,119,87,0.1)', color: 'var(--accent-deep)', fontSize: 11, fontFamily: 'var(--font-mono)', padding: '3px 10px', borderRadius: 999, border: '0.5px solid rgba(217,119,87,0.25)' }}>
            #{myRank} z {leaderboard.length}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {leaderboard.slice(0, 5).map((r, i) => {
          const isMe = r.user_id === userId
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 9, background: isMe ? 'rgba(217,119,87,0.07)' : 'var(--paper-100)', border: isMe ? '0.5px solid rgba(217,119,87,0.2)' : '0.5px solid var(--line)' }}>
              <span style={{ fontSize: 13, width: 22, textAlign: 'center', flexShrink: 0 }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{i + 1}.</span>}
              </span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: isMe ? 500 : 400 }}>
                {(r.profiles as { username?: string })?.username ?? t('daily.player')}
                {isMe && <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 6 }}>ty</span>}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: isMe ? 600 : 400, color: isMe ? 'var(--accent)' : 'var(--ink)' }}>{r.score.toLocaleString(currentLocale())}</span>
            </div>
          )
        })}
      </div>
    </div>
  )

  // Vyhodnocení (XP/level + achievementy) — jen po dnešním odehrání
  const evalSection = !alreadyPlayed && userId ? (
    <div style={{ padding: isMobile ? '0 12px 8px' : '0 20px 14px' }}>
      <GameEvaluation
        userId={userId}
        gainedXp={Math.round((result.totalScore + XP_BONUS_DAILY) * result.xpMult)}
        gameHits={event.category && result.totalScore >= 950 ? { [event.category]: 1 } : {}}
      />
    </div>
  ) : null

  // ── Desktop ────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div style={{ height: '100dvh', background: 'var(--paper-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: 'var(--paper-50)', border: '1px solid var(--line)', borderRadius: 20, maxWidth: 860, width: '100%', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr', maxHeight: 'calc(100dvh - 40px)' }}>
          {/* Levá — výsledky */}
          <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)', overflow: 'auto' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 4 }}>
                {alreadyPlayed ? t('daily.alreadyPlayed') : t('daily.resultTitle')}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, letterSpacing: '-0.01em', flex: 1 }}>{eventTitle(event)}</div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 34, color: 'var(--accent)', letterSpacing: '-0.03em', lineHeight: 1 }}>{result.totalScore.toLocaleString(currentLocale())}<span style={{ fontSize: 16, marginLeft: 3 }}>{t('common.pts')}</span></div>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>{t('game.outOf1000')}</div>
                </div>
              </div>
            </div>
            {resultTabs}
            {tab === 'score' ? <>{scoreSection}{evalSection}</> : infoSection}
            <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--line)', marginTop: 'auto' }}>
              <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onMenu}>{t('daily.menu')}</button>
            </div>
          </div>
          {/* Pravá — žebříček + histogram */}
          <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1 }}>{leaderboardSection}</div>
            {leaderboard.length > 1 && (
              <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--line)', paddingTop: 16 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 12px' }}>{t('daily.distribution')}</p>
                <ScoreHistogram scores={allScores} myScore={result.totalScore}/>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Mobil ──────────────────────────────────────────────
  return (
    <div style={{ height: '100dvh', background: 'var(--paper-50)', display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingTop: 'env(safe-area-inset-top,0px)' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '0.5px solid var(--line)', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 4 }}>
          {alreadyPlayed ? t('daily.alreadyPlayed') : t('daily.resultTitle')}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, letterSpacing: '-0.01em', flex: 1, lineHeight: 1.2 }}>{eventTitle(event)}</div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--accent)', letterSpacing: '-0.03em', lineHeight: 1 }}>{result.totalScore.toLocaleString(currentLocale())}<span style={{ fontSize: 15, marginLeft: 3 }}>{t('common.pts')}</span></div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>{t('game.outOf1000')}</div>
          </div>
        </div>
      </div>

      {resultTabs}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'score' ? <>{scoreSection}{evalSection}</> : infoSection}
        {leaderboardSection}
      </div>

      {/* Tlačítka */}
      <div style={{ flexShrink: 0, padding: '8px 12px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', borderTop: '0.5px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {leaderboard.length > 1 && (
          <button
            onClick={() => setHistModal(true)}
            style={{ width: '100%', padding: '10px', background: 'var(--paper-200)', border: '0.5px solid var(--line-strong)', borderRadius: 10, fontSize: 13, cursor: 'pointer', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            📊 Zobrazit distribuci skóre
          </button>
        )}
        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onMenu}>{t('daily.menu')}</button>
      </div>

      {/* Histogram modal (bottom sheet) */}
      {histModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(13,9,6,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', background: 'var(--paper-50)', borderRadius: '20px 20px 0 0', padding: '20px 18px', paddingBottom: 'max(20px, env(safe-area-inset-bottom))', boxShadow: '0 -8px 32px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: 0 }}>{t('daily.distribution')}</p>
              <button onClick={() => setHistModal(false)} style={{ background: 'var(--paper-200)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--ink-2)' }}>{t('daily.close')}</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{t('daily.yourScore')}</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--accent)' }}>{result.totalScore.toLocaleString(currentLocale())}</span>
            </div>
            <ScoreHistogram scores={allScores} myScore={result.totalScore}/>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Score karta ───────────────────────────────────────────
function ScoreCard({ label, score, pct, sub, highlight }: { label: string; score: number; pct: number; sub: string; highlight?: boolean }) {
  return (
    <div style={{ background: 'var(--paper-200)', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 8 }}>{score.toLocaleString(currentLocale())}</div>
      <div style={{ height: 3, background: 'rgba(42,31,23,0.12)', borderRadius: 999, overflow: 'hidden', marginBottom: 5 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: highlight ? '#1d6b3a' : 'var(--accent)', borderRadius: 999 }}/>
      </div>
      <div style={{ fontSize: 11, color: highlight ? '#1d6b3a' : 'var(--ink-3)' }}>{sub}</div>
    </div>
  )
}
