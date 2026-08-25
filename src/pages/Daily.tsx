import { useEffect, useState, useRef, useCallback, type CSSProperties } from 'react'
import { currentLocale } from '@/i18n'
import { useTranslation } from 'react-i18next'
import { eventTitle, eventDescription } from '@/lib/eventLocale'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { buildChallengeUrl, shareChallenge } from '@/lib/challenge'
import {
  getDailyChallenge, getTodayDailyResult,
  submitDailyResult, startDailyChallenge, getDailyStart, getDailyGlobalLeaderboard, getDailyAllScores, recordEventScore, recordCategoryHit, track,
  getDailyChallengeForDate, getDailyMakeupStatus, submitDailyMakeup, getUserDailyResults, localDateISO,
} from '@/lib/supabase'
import { computeDailyStreak } from '@/lib/streak'
import { streakUnlocks, type UnlockedTier } from '@/lib/achievements'
import StreakLadder from '@/components/StreakLadder'
import { haversineKm, roundScore, yearDiff, formatYear, formatDistance } from '@/lib/scoring'
import { panoramaHfov, encodePanoramaUrl } from '@/lib/panorama'
import { XP_BONUS_DAILY } from '@/lib/leveling'
import BackButton from '@/components/BackButton'
import GameEvaluation from '@/components/GameEvaluation'
import ControlDock from '@/components/GameControls'
import type { Event } from '@/types/database'
import type { DailyLeaderRow } from '@/lib/supabase'
import { GuessMap, ResultMap } from '@/components/GameMap'
import { invalidateMenuCache } from '@/pages/Menu'
import ShareResult from '@/components/ShareResult'
import EraToggle from '@/components/EraToggle'
import RoundResult, { type DetailTab } from '@/components/round/RoundResult'
import RoundDetail, { type LeaderEntry, type Distribution } from '@/components/round/RoundDetail'
import RoundResultDesktop from '@/components/round/RoundResultDesktop'
import RoundReveal from '@/components/round/RoundReveal'
import EventRating from '@/components/EventRating'
import Icon from '@/components/Icon'
import { useIsMobile } from '@/hooks/useIsMobile'
import { roundMetaLine } from '@/lib/eventLocale'

declare const pannellum: {
  viewer: (container: HTMLElement, config: Record<string, unknown>) => { destroy: () => void }
}

// Denní výzva nemá časový limit. Minuta je jen okno pro XP bonus —
// server násobí XP podle uplynulého času (viz submit_daily_result, migrace 033).
const BONUS_WINDOW = 60

type Phase = 'loading' | 'no_challenge' | 'already_played' | 'warning' | 'playing' | 'result'

export default function DailyChallengePage() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const chParam = searchParams.get('ch')
  const challengeTarget = chParam ? Math.max(0, Math.min(1000, parseInt(chParam, 10) || 0)) : null
  const challengeBy = (searchParams.get('by') || '').slice(0, 24)

  const [phase, setPhase] = useState<Phase>('loading')
  const [event, setEvent] = useState<Event | null>(null)
  const [leaderboard, setLeaderboard] = useState<DailyLeaderRow[]>([])
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
  // Příběh události po odeslání tipu (u již dříve odehrané výzvy se neukazuje)
  // Make-up: doplnění zameškané výzvy. `makeup` = datum (ISO) doplňovaného dne.
  const [makeup, setMakeup] = useState<string | null>(null)
  const [makeupStatus, setMakeupStatus] = useState<{ balance: number; missed: string[] }>({ balance: 0, missed: [] })
  const [showMakeup, setShowMakeup] = useState(false)
  // Odznaky za streak, které se právě získaly (ukážou se na výsledku u XP).
  const [streakBadges, setStreakBadges] = useState<UnlockedTier[]>([])
  const [streak, setStreak] = useState(0)   // aktuální série (pro žebříček milníků)
  // Výsledek má 2 kroky: 'detail' (jak blízko/daleko, bez odznaků) → 'full' (odznaky, žebříček…)

  // Timer
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasSubmittedRef = useRef(false)
  const preloadImgRef = useRef<HTMLImageElement | null>(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  // Result state
  const [result, setResult] = useState<{
    distKm: number; locScore: number; yrScore: number; totalScore: number; yrDiff: number; xpMult: number
  } | null>(null)
  const elapsedRef = useRef(0)
  // Vždy ukazuje na AKTUÁLNÍ doSubmit (časovač jinak volá zastaralou closure s prázdným tipem)
  const doSubmitRef = useRef<(fl?: number | null, fln?: number | null, fy?: number) => void>(() => {})

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  async function load() {
    setPhase('loading')
    getDailyMakeupStatus().then(setMakeupStatus).catch(() => {})
    getUserDailyResults(user!.id).then(rows => setStreak(computeDailyStreak(new Set(rows.map(r => r.date))))).catch(() => {})
    const [ev, existing, lb, scores] = await Promise.all([
      getDailyChallenge(),
      getTodayDailyResult(user!.id),
      getDailyGlobalLeaderboard(),
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

    // Rozehraná dnešní výzva → pokračuj. Čas startu drží SERVER (read-only dotaz,
    // ať se čas nespustí dřív, než hráč klikne Start), takže refresh ho neresetuje.
    const startedAt = await getDailyStart(user!.id).catch(() => null)
    if (startedAt) { beginPlaying(new Date(startedAt).getTime()); return }

    // Preload panoramy na pozadí během warning screenu.
    // Držený Image() (ne <link rel=preload>, který prohlížeč zahodí, když se
    // zdroj nevyužije do pár sekund — a hráč na potvrzovací obrazovce čeká déle).
    // crossOrigin='anonymous' se shoduje s tím, jak obrázek načítá Pannellum,
    // takže se využije stejná cache položka a ve hře už se nestahuje znovu.
    if (ev.panorama_url && ev.panorama_url !== 'pending') {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.decoding = 'async'
      img.onload = () => setPanoramaReady(true)
      img.onerror = () => setPanoramaReady(true) // ať Start nezůstane zablokovaný
      img.src = encodePanoramaUrl(ev.panorama_url)
      preloadImgRef.current = img // reference, ať ho GC nezahodí
      setTimeout(() => setPanoramaReady(true), 5000) // fallback
    }

    setPhase('warning')
  }

  // Spuštění / obnovení hry — čas se počítá z pevného startu (wall-clock),
  // takže refresh stránky čas nerestartuje.
  function beginPlaying(startMs: number) {
    hasSubmittedRef.current = false
    if (timerRef.current) clearInterval(timerRef.current)
    const compute = () => Math.max(0, Math.floor((Date.now() - startMs) / 1000))
    const e = compute()
    setElapsed(e); elapsedRef.current = e
    setPhase('playing')

    // Stopky běží dál i po minutě — hráč nepřijde o body, jen o XP bonus.
    timerRef.current = setInterval(() => {
      const v = compute()
      elapsedRef.current = v
      setElapsed(v)
    }, 500)
  }

  // Spuštění hry po potvrzení (tlačítko Start).
  // Čas startu drží SERVER — opakované volání ho neresetuje.
  async function startGame() {
    track('daily_challenge_started', {}, user?.id)
    try {
      const { secondsLeft } = await startDailyChallenge()
      beginPlaying(Date.now() - (BONUS_WINDOW - secondsLeft) * 1000)
    } catch (e) {
      console.error('[Daily] start selhal:', e)
      beginPlaying(Date.now())
    }
  }

  // Cleanup timeru při unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // Spuštění doplnění zameškaného dne (bez časovače, bez XP bonusu).
  async function startMakeup(dateISO: string) {
    const ev = await getDailyChallengeForDate(dateISO)
    if (!ev) return
    if (timerRef.current) clearInterval(timerRef.current)
    setMakeup(dateISO)
    setEvent(ev)
    setGuessLat(null); setGuessLng(null); setGuessYear(0); setGuessYearSet(false)
    setResult(null); setShowMakeup(false)
    hasSubmittedRef.current = false
    setPhase('playing')
  }

  // Spočte, jestli se přidáním daného dne (dnešek / doplněný den) překročil
  // nějaký streak-milník → ty odznaky se ukážou na výsledku.
  async function computeStreakBadges(addedISO: string) {
    if (!user) return
    try {
      const rows = await getUserDailyResults(user.id)
      const all = new Set(rows.map(r => r.date))
      const before = new Set(all); before.delete(addedISO)
      const afterStreak = computeDailyStreak(all)
      setStreak(afterStreak)
      setStreakBadges(streakUnlocks(computeDailyStreak(before), afterStreak))
    } catch { /* odznaky jsou best-effort */ }
  }

  const doSubmit = useCallback(async (forceLat?: number | null, forceLng?: number | null, forceYear?: number) => {
    if (!event || !user || hasSubmittedRef.current) return
    hasSubmittedRef.current = true
    if (timerRef.current) clearInterval(timerRef.current)
    setSubmitting(true)

    const lat = forceLat !== undefined ? forceLat : guessLat
    const lng = forceLng !== undefined ? forceLng : guessLng
    const year = forceYear !== undefined ? forceYear : guessYear

    // Doplnění zameškané výzvy — server ověří lístek, uloží s is_makeup, bez bonusu.
    if (makeup) {
      try {
        const r = await submitDailyMakeup(makeup, lat, lng, year)
        setResult({ distKm: r.distanceKm, locScore: r.locationScore, yrScore: r.yearScore, totalScore: r.roundScore, yrDiff: r.yearDiff, xpMult: 1 })
      } catch (e) {
        console.error('[Daily] doplnění selhalo:', e)
        hasSubmittedRef.current = false
        setSubmitting(false)
        return
      }
      invalidateMenuCache()
      setLeaderboard([]); setAllScores([])
      getDailyMakeupStatus().then(setMakeupStatus).catch(() => {})
      computeStreakBadges(makeup)
      setSubmitting(false); setPhase('result')
      return
    }

    // Klient posílá JEN tip — skóre i XP násobič počítá server ze svého
    // času startu (migrace 033), takže je nejde ovlivnit konzolí ani refreshem.
    let locSc = 0, yrSc = 0, total = 0, dist = 20000, yrDiff_ = 0
    try {
      const r = await submitDailyResult(lat, lng, year)
      locSc = r.locationScore; yrSc = r.yearScore; total = r.roundScore
      dist = r.distanceKm; yrDiff_ = r.yearDiff
    } catch (e) {
      console.error('[Daily] odeslání selhalo:', e)
      hasSubmittedRef.current = false
      setSubmitting(false)
      return
    }

    // xpMult je jen pro zobrazení ve vyhodnocení; skutečné XP přiznal server
    const remain = Math.max(0, BONUS_WINDOW - elapsedRef.current)
    const xpMult = remain >= 10 ? remain / 10 : 1

    if (lat != null) setGuessLat(lat)
    if (lng != null) setGuessLng(lng)
    setGuessYear(year)
    setResult({ distKm: dist, locScore: locSc, yrScore: yrSc, totalScore: total, yrDiff: yrDiff_, xpMult })

    recordEventScore(event.id, locSc, yrSc)
    recordCategoryHit(event.id, total)
    // Zahoď cache menu, ať se streak a ✓ za dnešek projeví hned po návratu
    invalidateMenuCache()
    const [lb, scores] = await Promise.all([
      getDailyGlobalLeaderboard(),
      getDailyAllScores(),
    ])
    setLeaderboard(lb)
    setAllScores(scores)
    computeStreakBadges(localDateISO())
    setSubmitting(false)
    setPhase('result')
  }, [event, user, guessLat, guessLng, guessYear, profile?.username, makeup])

  useEffect(() => { doSubmitRef.current = doSubmit }, [doSubmit])

  async function handleSubmit() {
    await doSubmit()
  }

  const canSubmit = guessLat !== null && guessYearSet
  // Bonusové okno: pruh i barva se týkají jen XP násobiče, ne konce hry
  const bonusLeft = Math.max(0, BONUS_WINDOW - elapsed)
  const timerPct = (bonusLeft / BONUS_WINDOW) * 100
  const timerColor = bonusLeft > 20 ? '#d97757' : bonusLeft > 0 ? 'var(--danger)' : 'var(--ink-3)'
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`

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

  // ── Výsledek (redesign 17e): RoundResult + RoundDetail ──
  if ((phase === 'result' || phase === 'already_played') && event && result) {
    return (
      <>
      <DailyResultView
        event={event} result={result}
        guessLat={guessLat ?? 0} guessLng={guessLng ?? 0} guessYear={guessYear}
        leaderboard={leaderboard} allScores={allScores} userId={user?.id}
        alreadyPlayed={phase === 'already_played'} isMakeup={!!makeup}
        makeupCount={makeupStatus.balance}
        onMakeup={makeupStatus.missed.length > 0 ? () => setShowMakeup(true) : undefined}
        streakBadges={streakBadges}
        challengeTarget={challengeTarget} challengeBy={challengeBy}
        onMenu={() => navigate('/menu')}
      />
      {showMakeup && <MakeupSheet status={makeupStatus} onPick={startMakeup} onClose={() => setShowMakeup(false)}/>}
      </>
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

          {/* Neutrální nadpis — bez prozrazení, jaká událost to bude */}
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px, 6vw, 36px)', color: 'var(--on-dark)', margin: '0 0 28px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {t('daily.warningTitle')}
          </h1>

          {/* Pravidla */}
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px 20px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <RuleRow icon="⏱" text={t('daily.rule2')}/>
            <RuleRow icon="🏆" text={t('daily.rule3')}/>
          </div>

          {/* Žebříček milníků série */}
          <div style={{ marginBottom: 24 }}><StreakLadder streak={streak} tone="dark"/></div>

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

          {/* Doplnění zameškaných výzev */}
          {makeupStatus.balance > 0 && makeupStatus.missed.length > 0 && (
            <button onClick={() => setShowMakeup(true)} style={{ marginTop: 14, width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, padding: 12, color: 'rgba(245,241,232,0.9)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>
              🎟 {t('daily.makeupCta', { n: makeupStatus.balance })}
            </button>
          )}
        </div>
        {showMakeup && <MakeupSheet status={makeupStatus} onPick={startMakeup} onClose={() => setShowMakeup(false)}/>}
      </div>
    )
  }

  // ── Hra s časovačem ─────────────────────────────────────
  if (phase === 'playing' && event) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0d0906', position: 'relative', overflow: 'hidden' }}>

        {/* Tenký proužek času nahoře (v make-upu se čas neměří) */}
        {!makeup && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'rgba(0,0,0,0.18)', zIndex: 26 }}>
            <div style={{ height: '100%', width: `${timerPct}%`, background: timerColor, transition: 'width 1s linear, background 500ms' }}/>
          </div>
        )}

        {/* Plovoucí skleněný HUD */}
        <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top,0px) + 12px)', left: 0, right: 0, zIndex: 25, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '0 14px', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', minWidth: 0, maxWidth: '64%', borderRadius: 16, padding: '7px 14px', background: 'rgba(246,240,230,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.5)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.12em', color: 'var(--accent-deep)', textTransform: 'uppercase' }}>{t('menu.dailyMobile')}</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: '#26211C', lineHeight: 1.15, overflowWrap: 'anywhere' }}>{eventTitle(event)}</div>
          </div>
          <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 6, height: 38, borderRadius: 20, padding: '0 14px', background: 'rgba(246,240,230,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', fontSize: makeup ? 11 : 16, fontWeight: 600, letterSpacing: makeup ? '0.1em' : undefined, color: makeup ? 'var(--accent-deep)' : timerColor, transition: 'color 500ms' }}>
            {makeup ? `🎟 ${t('daily.makeupBadge')}` : `⏱ ${clock}`}
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
                  {clock}
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
                    {clock}
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

// ── Sheet: doplnění zameškaných výzev ────────────────────
function MakeupSheet({ status, onPick, onClose }: {
  status: { balance: number; missed: string[] }; onPick: (dateISO: string) => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const loc = currentLocale()
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(13,9,6,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--paper-50)', borderRadius: '20px 20px 0 0', padding: '20px 18px', paddingBottom: 'max(20px, env(safe-area-inset-bottom))', boxShadow: '0 -8px 32px rgba(0,0,0,0.35)', maxHeight: '80dvh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 21 }}>{t('daily.makeupTitle')}</div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-deep)', background: 'rgba(217,119,87,0.10)', border: '1px solid rgba(217,119,87,0.25)', borderRadius: 20, padding: '4px 11px' }}>🎟 {t('daily.makeupTokens', { n: status.balance })}</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '0 0 16px', lineHeight: 1.5 }}>{t('daily.makeupIntro')}</p>
        {status.missed.length === 0 ? (
          <p style={{ fontSize: 13.5, color: 'var(--ink-3)', textAlign: 'center', padding: '20px 0' }}>{t('daily.makeupNone')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {status.missed.map(d => (
              <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '11px 14px' }}>
                <span style={{ flex: 1, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                  {new Date(d + 'T00:00:00').toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'long' })}
                </span>
                <button onClick={() => onPick(d)} disabled={status.balance < 1}
                  style={{ background: status.balance < 1 ? 'var(--paper-300)' : 'var(--accent)', color: status.balance < 1 ? 'var(--ink-3)' : '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, cursor: status.balance < 1 ? 'default' : 'pointer' }}>
                  {t('daily.makeupPlay')}
                </button>
              </div>
            ))}
          </div>
        )}
        <button onClick={onClose} style={{ width: '100%', marginTop: 16, background: 'var(--paper-200)', border: '1px solid var(--line)', borderRadius: 11, padding: 12, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}>{t('common.close')}</button>
      </div>
    </div>
  )
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
      v = pannellum.viewer(ref.current, { type: 'equirectangular', panorama: encodePanoramaUrl(url), autoLoad: true, showControls: false, hfov: panoramaHfov(), maxHfov: panoramaHfov() })
    } catch { /* pannellum selhal — viewer zůstane prázdný */ }
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
  const [draft, setDraft] = useState<string | null>(null)
  const sign = value < 0 ? -1 : 1
  function handleInput(raw: string) {
    const digits = raw.replace(/\D/g, '')
    if (digits === '') { setDraft(''); return }
    setDraft(digits)
    const mag = parseInt(digits, 10)
    if (isNaN(mag)) return
    let nv = sign * mag
    if (nv === 0) nv = sign
    onChange(Math.max(MIN, Math.min(MAX, nv)))
  }
  const inputValue = draft !== null ? draft : String(Math.abs(value))
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
      <input type="text" inputMode="numeric" pattern="[0-9]*" value={inputValue}
        onChange={e => handleInput(e.target.value)}
        onBlur={() => setDraft(null)}
        placeholder={t('daily.yearPlaceholder')}
        style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 18, padding: '11px 14px', border: '1px solid var(--line-strong)', borderRadius: 10, color: 'var(--ink)', background: 'var(--surface)', outline: 'none' }}
      />
      <EraToggle bc={value < 0} onSelect={(bc) => { const mag = Math.abs(value) || 1; onChange(Math.max(MIN, Math.min(MAX, bc ? -mag : mag))) }}/>
    </div>
  )
}

// ── Histogram ─────────────────────────────────────────────
// Modal distribuce — bottom sheet na mobilu, vycentrovaná karta na desktopu.

// ── Výsledek denní výzvy (redesign 17e) ───────────────────
function DailyResultView({ event, result, guessLat, guessLng, guessYear, leaderboard, allScores, userId, alreadyPlayed, isMakeup = false, makeupCount = 0, onMakeup, streakBadges, challengeTarget, challengeBy, onMenu }: {
  event: Event; result: { distKm: number; locScore: number; yrScore: number; totalScore: number; yrDiff: number; xpMult: number }
  guessLat: number; guessLng: number; guessYear: number
  leaderboard: DailyLeaderRow[]; allScores: number[]; userId?: string; alreadyPlayed: boolean; isMakeup?: boolean
  makeupCount?: number; onMakeup?: () => void; streakBadges?: UnlockedTier[]; onMenu: () => void
  challengeTarget?: number | null; challengeBy?: string
}) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [detailTab, setDetailTab] = useState<DetailTab | null>(null)
  const [showShare, setShowShare] = useState(false)
  // Mezikrok: popis události + hodnocení → skóre. Znovunavštívení (už odehráno) ho přeskočí.
  const [scoreShown, setScoreShown] = useState(alreadyPlayed)
  const { profile } = useAuth()
  const loc = currentLocale()

  // Chytrá pochvala dle skóre (0–1000) — jen denní výzva
  const praise = (() => {
    const s = result.totalScore
    if (s >= 950) return t('daily.praise.perfect')
    if (s >= 850) return t('daily.praise.great')
    if (s >= 700) return t('daily.praise.good')
    if (s >= 500) return t('daily.praise.ok')
    if (s >= 300) return t('daily.praise.meh')
    return t('daily.praise.low')
  })()

  const yearLabel = result.yrDiff === 0 ? t('daily.exact') : t('game.yearOff', { n: result.yrDiff })
  const betterThan = allScores.length >= 5 ? Math.round((allScores.filter(v => v < result.totalScore).length / (allScores.length - 1)) * 100) : null
  const dateLabel = new Date().toLocaleDateString(loc, { day: 'numeric', month: 'long' })
  const doChallenge = async () => {
    const url = buildChallengeUrl(event.id, result.totalScore, profile?.username, { daily: true })
    await shareChallenge(url, t('challenge.shareText', { score: result.totalScore }))
  }
  const shareData = { dateLabel, score: result.totalScore, maxScore: 1000, locScore: result.locScore, yearScore: result.yrScore, distanceLabel: formatDistance(result.distKm), yearLabel, betterThan }
  const shareText = [`HistoryGuesser · ${t('menu.dailyMobile')} · ${dateLabel}`, `★ ${result.totalScore} / 1000`, `${t('common.place')}: ${formatDistance(result.distKm)} · ${t('common.year')}: ${yearLabel}`, 'historyguesser.net'].join('\n')

  const entries: LeaderEntry[] = leaderboard.map(r => ({
    id: r.user_id, name: r.username ?? t('daily.player'), score: r.score,
    distanceKm: (r.guess_lat != null && r.guess_lng != null) ? haversineKm(r.guess_lat, r.guess_lng, event.lat, event.lng) : 0,
    yearOff: r.guess_year != null ? yearDiff(r.guess_year, event.year_from, event.year_to) : 0,
    isMe: r.user_id === userId,
  }))

  const BINS = 9
  const bins = Array(BINS).fill(0) as number[]
  allScores.forEach(sc => { bins[Math.min(BINS - 1, Math.floor((sc / 1000) * BINS))]++ })
  const distribution: Distribution = {
    bins,
    myBinIndex: Math.min(BINS - 1, Math.floor((result.totalScore / 1000) * BINS)),
    // Podíl OSTATNÍCH hráčů (bez tebe), které jsi překonal → nejlepší = 100 %
    percentileBetterThan: allScores.length > 1 ? Math.round((allScores.filter(sc => sc < result.totalScore).length / (allScores.length - 1)) * 100) : 100,
  }

  const hasPanorama = !!event.panorama_url && event.panorama_url !== 'pending'
  const map = <ResultMap guessLat={guessLat} guessLng={guessLng} truthLat={event.lat} truthLng={event.lng} radiusKm={event.location_radius_km ?? 0}/>
  const panorama = hasPanorama ? <PanoramaViewer url={event.panorama_url}/> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(245,241,232,.6)', fontSize: 13 }}>{t('game.panoramaUnavailable')}</div>
  const story = <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink-2)', margin: 0 }}>{eventDescription(event)}</p>
  const xpSection = (!alreadyPlayed && userId) ? <GameEvaluation userId={userId} gainedXp={Math.round((result.totalScore + XP_BONUS_DAILY) * result.xpMult)} gameHits={event.category && result.totalScore >= 950 ? { [event.category]: 1 } : {}} extraUnlocked={streakBadges}/> : null

  // Srovnání s kamarádovou výzvou (fixní pilulka nad výsledkem — vidí ji i „už odehráno")
  const challengeBanner = (challengeTarget != null) ? (() => {
    const won = result.totalScore > challengeTarget, tie = result.totalScore === challengeTarget
    const byName = challengeBy || t('challenge.kicker')
    return (
      <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top,0px) + 10px)', left: '50%', transform: 'translateX(-50%)', zIndex: 130, maxWidth: '92vw', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, background: won ? 'rgba(76,122,80,.95)' : 'rgba(28,24,18,.92)', color: '#fff', backdropFilter: 'blur(8px)', boxShadow: '0 8px 24px rgba(0,0,0,.3)', fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <Icon name="swords" size={14}/>
        <span>{(tie ? t('challenge.tie') : won ? t('challenge.youWonNoName') : t('challenge.youLostNoName'))} · {t('challenge.vsLine', { you: result.totalScore.toLocaleString(loc), by: byName, them: challengeTarget.toLocaleString(loc) })}</span>
      </div>
    )
  })() : null

  // Mezikrok: nejdřív popis události + hodnocení, pak skóre
  if (!scoreShown) {
    return (<>
      <RoundReveal
        heroUrl={event.event_image_url}
        eventTitle={eventTitle(event)} eventYear={event.year}
        description={eventDescription(event)}
        rating={<EventRating eventId={event.id}/>}
        onReveal={() => setScoreShown(true)} enableSpaceKey
      />
    </>)
  }

  if (!isMobile) {
    return (<>
      <RoundResultDesktop
        map={map} panorama={panorama}
        eventTitle={eventTitle(event)} eventYear={event.year} metaLine={roundMetaLine(event)}
        story={story}
        scoreTotal={result.totalScore} scoreMax={1000}
        distanceKm={result.distKm} placePoints={result.locScore} placeMax={500}
        yearOff={result.yrDiff} yearPoints={result.yrScore} yearMax={500} guessYear={guessYear}
        praise={praise}
        leaderboard={entries} playersToday={entries.length} distribution={distribution}
        xpSection={xpSection}
        onShare={isMakeup ? null : () => setShowShare(true)}
        ctaLabel={t('daily.menu')} onCta={onMenu}
      />
      {showShare && <ShareResult data={shareData} shareText={shareText} onClose={() => setShowShare(false)}/>}
      {challengeBanner}
    </>)
  }

  if (detailTab) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'var(--paper-200)' }}>
        <RoundDetail
          initialTab={detailTab}
          title={eventTitle(event)}
          subtitle={`${result.totalScore.toLocaleString(loc)} ${t('common.pts')} · ${formatYear(event.year)}`}
          leaderboard={entries} playersToday={entries.length} distribution={distribution}
          story={story} xpSection={xpSection}
          onChallenge={isMakeup ? undefined : doChallenge}
          onShare={isMakeup ? undefined : () => setShowShare(true)}
          onBack={() => setDetailTab(null)} ctaLabel={t('daily.menu')} onCta={onMenu}
        />
      </div>
    )
  }

  const ghost: CSSProperties = { flex: 1, padding: '9px 0', borderRadius: 11, border: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }
  const makeupAction = (!isMakeup && makeupCount > 0 && onMakeup)
    ? <button onClick={onMakeup} style={ghost}>🎟 {t('daily.makeupCta', { n: makeupCount })}</button>
    : null

  return (<>
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'var(--paper-200)' }}>
      <RoundResult
        map={map} roundLabel={null}
        eventTitle={eventTitle(event)} eventYear={event.year}
        scoreTotal={result.totalScore} scoreMax={1000}
        distanceKm={result.distKm} placePoints={result.locScore} placeMax={500}
        yearOff={result.yrDiff} yearPoints={result.yrScore} yearMax={500} guessYear={guessYear}
        praise={praise}
        panorama={panorama}
        showDetail onOpenDetail={setDetailTab}
        onChallenge={isMakeup ? undefined : doChallenge}
        ctaLabel={t('daily.menu')} onCta={onMenu}
        secondaryActions={makeupAction}    />
    </div>
    {showShare && <ShareResult data={shareData} shareText={shareText} onClose={() => setShowShare(false)}/>}
    {challengeBanner}
  </>)
}
