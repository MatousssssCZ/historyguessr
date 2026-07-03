import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { currentLocale } from '@/i18n'
import { useTranslation } from 'react-i18next'
import { eventTitle, eventDescription } from '@/lib/eventLocale'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  getRound, getPlayers, subscribeToRoom, submitAnswer,
  getRoundAnswers, advanceRound, getRoomPanoramas, getMyMatchHits,
} from '@/lib/multiplayer'
import { preloadImage } from '@/lib/preload'
import GameEvaluation from '@/components/GameEvaluation'
import type { MultiplayerRoom, MultiplayerPlayer, MultiplayerRound, MultiplayerAnswer } from '@/lib/multiplayer'
import { haversineKm, roundScore, yearDiff, formatYear } from '@/lib/scoring'
import { supabase, recordEventScore, recordCategoryHit } from '@/lib/supabase'
import type { Event } from '@/types/database'
import { GuessMap, ResultMap } from '@/components/GameMap'
import ControlDock from '@/components/GameControls'

declare const pannellum: {
  viewer: (container: HTMLElement, config: Record<string, unknown>) => { destroy: () => void }
}

type Phase = 'loading' | 'countdown' | 'playing' | 'my_results' | 'round_results' | 'finished'

interface MyResult {
  distKm: number; locScore: number; yrScore: number; totalScore: number; yrDiff: number
  guessLat: number; guessLng: number; guessYear: number
}

const NEXT_ROUND_DELAY = 8000

export default function MultiplayerGamePage() {
  const { t } = useTranslation()
  const { roomId } = useParams<{ roomId: string }>()
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<Phase>('loading')
  const [room, setRoom] = useState<MultiplayerRoom | null>(null)
  const [players, setPlayers] = useState<MultiplayerPlayer[]>([])
  const [currentRound, setCurrentRound] = useState<MultiplayerRound | null>(null)
  const [roundAnswers, setRoundAnswers] = useState<MultiplayerAnswer[]>([])

  // Guess state
  const [guessLat, setGuessLat] = useState<number | null>(null)
  const [guessLng, setGuessLng] = useState<number | null>(null)
  const [guessYear, setGuessYear] = useState(0)
  const [guessYearSet, setGuessYearSet] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [yearExpanded, setYearExpanded] = useState(false)

  // Timer
  const [timeLeft, setTimeLeft] = useState(60)
  const [countdownSecs, setCountdownSecs] = useState(3)   // odpočet 3-2-1 mezi koly
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const barRef = useRef<HTMLDivElement>(null)             // plynulý progress bar času
  const hasSubmittedRef = useRef(false)

  // Results
  const [myResult, setMyResult] = useState<MyResult | null>(null)
  const [activeTab, setActiveTab] = useState<'round' | 'total'>('round')
  const [nextRoundCountdown, setNextRoundCountdown] = useState(NEXT_ROUND_DELAY / 1000)
  const nextRoundTotalRef = useRef(NEXT_ROUND_DELAY / 1000) // celková délka okna výsledků (pro kruh)
  const nextRoundTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  // Časově řízený postup — bez závislosti na hostovi
  const phaseRef = useRef<Phase>(phase)
  useEffect(() => { phaseRef.current = phase }, [phase])
  const advancedRoundRef = useRef<number | null>(null)
  const shownResultsRef = useRef<number | null>(null)

  // Vždy aktuální místnost a číslo kola pro realtime callbacky
  // (jinak se uzavřou nad počáteční hodnotou a čtou špatné kolo)
  const roomRef = useRef<MultiplayerRoom | null>(null)
  useEffect(() => { roomRef.current = room }, [room])
  const currentRoundNoRef = useRef<number | null>(null)

  // Prefetch panoramat: kolo → URL. Plníme jednou na začátku hry.
  const panoramasRef = useRef<Map<number, string>>(new Map())

  // Osobní vyhodnocení (XP/achievementy) na konci zápasu
  const [matchHits, setMatchHits] = useState<Record<string, number>>({})
  useEffect(() => {
    if (phase !== 'finished' || !roomId || !user) return
    getMyMatchHits(roomId, user.id).then(setMatchHits).catch(() => {})
  }, [phase, roomId, user])

  const isHost = room?.host_id === user?.id

  useEffect(() => {
    if (!roomId || !user) return
    initGame()
    return () => {
      unsubRef.current?.()
      if (timerRef.current) clearInterval(timerRef.current)
      if (nextRoundTimerRef.current) clearInterval(nextRoundTimerRef.current)
    }
  }, [roomId, user])

  async function initGame() {
    if (!roomId) return
    const { data: roomData } = await supabase.from('multiplayer_rooms').select('*').eq('id', roomId).single()
    if (!roomData) { navigate('/menu'); return }
    const room_ = roomData as MultiplayerRoom
    setRoom(room_)
    roomRef.current = room_
    const players_ = await getPlayers(roomId)
    setPlayers(players_)

    // Prefetch: natáhni mapu všech panoramat a hned přednačti aktuální + další kolo.
    // Aktuální kolo se tak stáhne během 3s countdownu, ne až po jeho startu.
    getRoomPanoramas(roomId).then(panos => {
      panos.forEach(p => panoramasRef.current.set(p.round_number, p.panorama_url))
      preloadImage(panoramasRef.current.get(room_.current_round))
      preloadImage(panoramasRef.current.get(room_.current_round + 1))
    })

    unsubRef.current = subscribeToRoom(
      roomId,
      async (updatedRoom) => {
        const prevRound = roomRef.current?.current_round
        setRoom(updatedRoom)
        roomRef.current = updatedRoom
        if (updatedRoom.status === 'finished') {
          // Refetch hráčů, ať závěrečná listina ukáže skóre všech
          setPlayers(await getPlayers(roomId))
          setPhase('finished')
          return
        }
        if (updatedRoom.current_round !== prevRound) {
          // Nové kolo — načti round data
          await loadRound(roomId, updatedRoom.current_round, updatedRoom)
        }
      },
      (updatedPlayers) => setPlayers(updatedPlayers),
      async () => {
        // Nová odpověď — refetch odpovědí i hráčů pro AKTUÁLNÍ kolo,
        // ať se průběžně aktualizuje žebříček kola i celkové skóre všech
        const rn = currentRoundNoRef.current
        if (roomId && rn != null) {
          const [answers, ps] = await Promise.all([getRoundAnswers(roomId, rn), getPlayers(roomId)])
          setRoundAnswers(answers)
          setPlayers(ps)
        }
      },
    )

    await loadRound(roomId, room_.current_round, room_)
  }

  async function loadRound(rId: string, roundNum: number, room_: MultiplayerRoom) {
    const round = await getRound(rId, roundNum)
    if (!round) return
    currentRoundNoRef.current = roundNum
    setCurrentRound(round)
    hasSubmittedRef.current = false
    setGuessLat(null); setGuessLng(null); setGuessYear(0); setGuessYearSet(false)
    setMyResult(null); setRoundAnswers([])

    if (round.started_at) {
      startRoundTimer(round.started_at, room_.settings.time_limit)
    }
  }

  function startRoundTimer(startedAt: string, timeLimit: number) {
    if (timerRef.current) clearInterval(timerRef.current)

    const startMs = new Date(startedAt).getTime()

    // Odpočet 3-2-1
    const now = Date.now()
    const msUntilStart = startMs - now

    if (msUntilStart > 0) {
      setPhase('countdown')
      setCountdownSecs(Math.max(1, Math.ceil(msUntilStart / 1000)))
      timerRef.current = setInterval(() => {
        const remaining = new Date(startedAt).getTime() - Date.now()
        if (remaining <= 0) {
          clearInterval(timerRef.current!)
          setPhase('playing')
          startPlayTimer(startedAt, timeLimit)
        } else {
          // průběžně aktualizuj číslo, ať animace 3-2-1 opravdu běží
          setCountdownSecs(Math.ceil(remaining / 1000))
        }
      }, 100)
    } else {
      setPhase('playing')
      startPlayTimer(startedAt, timeLimit)
    }
  }

  function startPlayTimer(startedAt: string, timeLimit: number) {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000
      const remaining = Math.max(0, timeLimit - elapsed)
      setTimeLeft(Math.ceil(remaining))
      if (remaining <= 0) {
        clearInterval(timerRef.current!)
        if (!hasSubmittedRef.current) handleAutoSubmitRef.current()
      }
    }, 200)
  }

  // Vyřazený hráč (Battle Royale) jen sleduje — neodesílá odpovědi
  const amEliminatedRef = useRef(false)

  const handleAutoSubmit = useCallback(async () => {
    if (amEliminatedRef.current) return
    if (!currentRound?.events || !user || !roomId || hasSubmittedRef.current) return
    hasSubmittedRef.current = true
    await doSubmit(currentRound.events, guessLat, guessLng, guessYear, guessYearSet)
  }, [currentRound, user, roomId, guessLat, guessLng, guessYear, guessYearSet])

  // Vždy ukazuje na AKTUÁLNÍ handleAutoSubmit (časovač jinak volá zastaralou closure s prázdným tipem)
  const handleAutoSubmitRef = useRef(handleAutoSubmit)
  useEffect(() => { handleAutoSubmitRef.current = handleAutoSubmit }, [handleAutoSubmit])

  async function doSubmit(
    event: Event,
    lat: number | null, lng: number | null,
    year: number, yearSet: boolean,
  ) {
    if (amEliminatedRef.current) return
    if (!user || !roomId || !currentRound) return
    hasSubmittedRef.current = true
    if (timerRef.current) clearInterval(timerRef.current)

    const yf = event.year_from ?? event.year; const yt = event.year_to ?? event.year
    const dist = lat !== null && lng !== null ? haversineKm(lat, lng, event.lat, event.lng) : 20000
    const { location_score: locSc, year_score: yrSc, round_score: total } = roundScore(dist, yearSet ? year : 0, yf, yt, event.location_radius_km ?? 0)
    const yrDiff_ = yearDiff(yearSet ? year : 0, yf, yt)

    const answer = {
      guess_lat: lat ?? 0, guess_lng: lng ?? 0, guess_year: yearSet ? year : 0,
      location_score: locSc, year_score: yrSc, round_score: total,
    }

    setMyResult({ distKm: dist, locScore: locSc, yrScore: yrSc, totalScore: total, yrDiff: yrDiff_, guessLat: lat ?? 0, guessLng: lng ?? 0, guessYear: yearSet ? year : 0 })
    setPhase('my_results')

    recordEventScore(event.id, locSc, yrSc)
    recordCategoryHit(event.id, total)
    // submitAnswer si připíše skóre samo (increment_multiplayer_score / fallback).
    // NESMÍ se volat updatePlayerTotalScore navíc — jinak se kolo započítá dvakrát.
    await submitAnswer(roomId, currentRound.round_number, user.id, answer)
  }

  async function handleShowRoundResults() {
    if (!roomId || !currentRound) return
    shownResultsRef.current = currentRound.round_number
    // Celková délka okna výsledků (od teď do postupu) — pro kruhový timer,
    // ať se kruh plní podle skutečně zbývajícího času, ne napevno z 8 s.
    const startedMs = currentRound.started_at ? new Date(currentRound.started_at).getTime() : Date.now()
    const advanceAt = startedMs + (room?.settings.time_limit ?? 60) * 1000 + NEXT_ROUND_DELAY
    nextRoundTotalRef.current = Math.max(1, Math.ceil((advanceAt - Date.now()) / 1000))
    // Refetch hráčů, ať „celkový" žebříček ukáže skóre všech (ne jen hosta)
    const [answers, ps] = await Promise.all([
      getRoundAnswers(roomId, currentRound.round_number),
      getPlayers(roomId),
    ])
    setRoundAnswers(answers)
    setPlayers(ps)
    setActiveTab('round')
    setPhase('round_results')
    // Postup do dalšího kola řeší časový „director" efekt níže (advanceRound)
  }

  // ── Director: časově řízený, idempotentní postup kola ──────
  // Kterýkoli připojený klient po vypršení okna výsledků zavolá
  // advanceRound; díky guardu v DB se posun provede jen jednou.
  useEffect(() => {
    if (!room || !currentRound?.started_at || !roomId) return
    const startedMs = new Date(currentRound.started_at).getTime()
    const playEnd = startedMs + room.settings.time_limit * 1000
    const advanceAt = playEnd + NEXT_ROUND_DELAY
    const roundNo = currentRound.round_number
    const total = room.settings.rounds

    const id = setInterval(() => {
      const now = Date.now()
      const p = phaseRef.current

      // Po konci hracího času ukaž žebříček i tomu, kdo neklikl / je AFK
      if (now >= playEnd && p === 'my_results' && shownResultsRef.current !== roundNo) {
        handleShowRoundResults()
      }
      // Odpočet do dalšího kola během žebříčku
      if (p === 'round_results') {
        setNextRoundCountdown(Math.max(0, Math.ceil((advanceAt - now) / 1000)))
      }
      // Posuň kolo (idempotentně) po vypršení okna výsledků
      if (now >= advanceAt && advancedRoundRef.current !== roundNo) {
        advancedRoundRef.current = roundNo
        advanceRound(roomId, roundNo, total, room.settings.mode ?? 'classic')
      }
    }, 250)

    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRound?.round_number, currentRound?.started_at, room?.id])

  // Jakmile běží kolo N, na pozadí přednačti panorama kola N+1
  // (máme celé kolo času, takže další kolo startuje s panoramatem už v cache).
  useEffect(() => {
    const rn = currentRound?.round_number
    if (rn == null) return
    preloadImage(panoramasRef.current.get(rn + 1))
  }, [currentRound?.round_number])

  // Plynulý progress bar času — místo skoků po vteřinách necháme animaci
  // na CSS: nastavíme aktuální šířku a pak ji během zbývajícího času
  // lineárně přejedeme na 0 (jediný přechod, žádné překreslování po vteřině).
  useLayoutEffect(() => {
    if (phase !== 'playing' || !currentRound?.started_at || !room) return
    const el = barRef.current
    if (!el) return
    const startMs = new Date(currentRound.started_at).getTime()
    const total = room.settings.time_limit * 1000
    const remaining = Math.max(0, total - (Date.now() - startMs))
    const startPct = Math.max(0, Math.min(100, (remaining / total) * 100))
    el.style.transition = 'none'
    el.style.width = `${startPct}%`
    void el.offsetWidth // vynuť reflow, ať start není přeskočen
    el.style.transition = `width ${remaining}ms linear`
    el.style.width = '0%'
  }, [phase, currentRound?.started_at, room?.id])

  const event = currentRound?.events as Event | undefined
  // Battle Royale stav
  const isBR = (room?.settings.mode ?? 'classic') === 'battle_royale'
  const me = players.find(p => p.user_id === user?.id)
  const amEliminated = isBR && !!me?.eliminated
  const aliveCount = players.filter(p => !p.eliminated).length
  amEliminatedRef.current = amEliminated
  const canSubmit = guessLat !== null && guessYearSet
  const timerColor = timeLeft > 15 ? '#d97757' : '#c0392b'

  // ── Countdown ─────────────────────────────────────────
  if (phase === 'countdown') {
    const secs = countdownSecs
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0d0906', gap: 12 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', color: 'var(--accent)', textTransform: 'uppercase' }}>
          {t('game.round', { n: currentRound?.round_number, total: room?.settings.rounds })}
        </p>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 100, color: 'var(--on-dark)', letterSpacing: '-0.04em', lineHeight: 1, animation: 'pulse 1s ease infinite' }}>
          {secs > 0 ? secs : '→'}
        </div>
        {event && <p style={{ fontSize: 14, color: 'rgba(245,241,232,0.4)', fontFamily: 'var(--font-serif)' }}>{eventTitle(event)}</p>}
        <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}`}</style>
      </div>
    )
  }

  // ── Finished ──────────────────────────────────────────
  if (phase === 'finished') {
    // BR: živý (vítěz) první, pak podle toho kdo přežil déle; jinak podle skóre
    const sorted = isBR
      ? [...players].sort((a, b) => {
          if (!!a.eliminated !== !!b.eliminated) return a.eliminated ? 1 : -1
          const ar = a.eliminated_round ?? 9999, br = b.eliminated_round ?? 9999
          if (ar !== br) return br - ar
          return b.total_score - a.total_score
        })
      : [...players].sort((a, b) => b.total_score - a.total_score)
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--paper-50)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#1a1208', padding: '20px 20px 16px', paddingTop: 'calc(20px + env(safe-area-inset-top,0px))', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 6px' }}>{t('mp.gameOverLine', { count: room?.settings.rounds ?? 0 })}</p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--on-dark)', margin: 0, letterSpacing: '-0.02em' }}>{t('mp.results')}</h1>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sorted.map((p, i) => {
            const isMe = p.user_id === user?.id
            const isWinner = isBR && !p.eliminated && i === 0
            return (
              <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, opacity: isBR && p.eliminated ? 0.6 : 1, background: isMe ? 'rgba(217,119,87,0.07)' : 'var(--paper-100)', border: isWinner ? '1px solid var(--accent)' : isMe ? '0.5px solid rgba(217,119,87,0.2)' : '0.5px solid var(--line)' }}>
                <span style={{ fontSize: 22, width: 28, textAlign: 'center' }}>
                  {isWinner ? '🏆' : i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </span>
                <span style={{ flex: 1, fontSize: 15, fontWeight: isMe ? 500 : 400 }}>
                  {p.username}{isMe && <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 6 }}>{t('lobby.you')}</span>}
                  {isWinner && <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 6 }}>{t('lobby.brWinner')}</span>}
                  {isBR && p.eliminated && p.eliminated_round != null && (
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 6 }}>{t('lobby.brOut')} · #{p.eliminated_round}</span>
                  )}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: isMe ? 600 : 400, color: isMe ? 'var(--accent)' : 'var(--ink)' }}>
                  {p.total_score.toLocaleString(currentLocale())}
                </span>
              </div>
            )
          })}

          {/* Tvůj postup — XP/level + odemčené achievementy za zápas */}
          {user && (
            <div style={{ marginTop: 12 }}>
              <p className="eyebrow" style={{ margin: '4px 0 10px' }}>{t('mp.yourProgress')}</p>
              <GameEvaluation userId={user.id} gainedXp={me?.total_score ?? 0} gameHits={matchHits}/>
            </div>
          )}
        </div>
        <div style={{ padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => navigate('/menu')}>{t('daily.menu')}</button>
          {isHost && (
            <button className="btn btn-accent" style={{ flex: 1 }} onClick={() => navigate(`/multiplayer/lobby`)}>
              {t('mp.newGame')}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── My results ────────────────────────────────────────
  if (phase === 'my_results' && myResult && event) {
    const locPct = Math.round(myResult.locScore / 5)
    const yrPct = Math.round(myResult.yrScore / 5)
    return (
      <div style={{ height: '100dvh', background: 'var(--paper-50)', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top,0px)' }}>
        <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--line)', flexShrink: 0 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 4px' }}>
            {t('game.round', { n: currentRound?.round_number, total: room?.settings.rounds })}
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, flex: 1, lineHeight: 1.2 }}>{eventTitle(event)}</div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--accent)', letterSpacing: '-0.03em', lineHeight: 1 }}>{myResult.totalScore.toLocaleString(currentLocale())}<span style={{ fontSize: 16, marginLeft: 3 }}>{t('common.pts')}</span></div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>{t('game.outOf1000')}</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ height: 160, overflow: 'hidden' }}>
            <ResultMap guessLat={myResult.guessLat} guessLng={myResult.guessLng} truthLat={event.lat} truthLng={event.lng} radiusKm={event.location_radius_km ?? 0}/>
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <ScoreCard label={t('game.location')} score={myResult.locScore} pct={locPct} sub={myResult.distKm < 1 ? '<1 km' : `${Math.round(myResult.distKm)} km`}/>
              <ScoreCard label={t('game.year')} score={myResult.yrScore} pct={yrPct} sub={myResult.yrDiff === 0 ? t('daily.exact') : t('game.yearOff', { n: myResult.yrDiff })} highlight={myResult.yrDiff === 0}/>
            </div>
            <div style={{ background: 'var(--paper-200)', borderRadius: 9, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>{t('game.correctYear')}</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500 }}>{formatYear(event.year)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>{t('game.yourGuess')}</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500 }}>{formatYear(myResult.guessYear)}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ flexShrink: 0, padding: '10px 14px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', borderTop: '0.5px solid var(--line)' }}>
          <button className="btn btn-accent" style={{ width: '100%', fontSize: 14, padding: '13px' }} onClick={handleShowRoundResults}>
            {t('mp.showResults')}
          </button>
        </div>
      </div>
    )
  }

  // ── Round results ─────────────────────────────────────
  if (phase === 'round_results' && event) {
    const myPlayer = players.find(p => p.user_id === user?.id)
    const sortedByRound = [...roundAnswers].sort((a, b) => b.round_score - a.round_score)
    const sortedByTotal = [...players].sort((a, b) => b.total_score - a.total_score)

    return (
      <div style={{ height: '100dvh', background: 'var(--paper-50)', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top,0px)' }}>

        {/* Header s kruhovým časovačem */}
        <div style={{ background: '#1a1208', padding: '14px 16px 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', color: 'rgba(217,119,87,0.6)', textTransform: 'uppercase', margin: '0 0 4px' }}>
                {t('game.round', { n: currentRound?.round_number, total: room?.settings.rounds })}
              </p>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--on-dark)', margin: 0, lineHeight: 1.2 }}>{eventTitle(event)}</p>
            </div>
            {/* Kruhový timer */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ position: 'relative', width: 44, height: 44 }}>
                <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3"/>
                  <circle cx="22" cy="22" r="18" fill="none" stroke="#d97757" strokeWidth="3"
                    strokeDasharray="113"
                    strokeDashoffset={113 * (1 - Math.max(0, Math.min(1, nextRoundCountdown / nextRoundTotalRef.current)))}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: 'var(--on-dark)' }}>{nextRoundCountdown}</span>
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'rgba(245,241,232,0.35)', textTransform: 'uppercase' }}>{t('mp.next')}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--paper-100)', borderBottom: '0.5px solid var(--line)', flexShrink: 0 }}>
          {([['round', '🏆', t('mp.tabRound')], ['total', '📊', t('mp.tabTotal')]] as const).map(([key, icon, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              style={{ padding: '10px 0', border: 'none', borderBottom: activeTab === key ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', fontSize: 12, fontWeight: activeTab === key ? 600 : 400, color: activeTab === key ? 'var(--accent)' : 'var(--ink-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <span style={{ fontSize: 14 }}>{icon}</span>{label}
            </button>
          ))}
        </div>

        {/* Obsah */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {activeTab === 'round' && (
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Moje skóre za kolo */}
              {myResult && (
                <div style={{ background: 'rgba(217,119,87,0.06)', border: '0.5px solid rgba(217,119,87,0.2)', borderRadius: 12, padding: '12px 14px', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{t('game.yourGuess')}</span>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--accent)', letterSpacing: '-0.02em' }}>{myResult.totalScore.toLocaleString(currentLocale())}<span style={{ fontSize: 13, marginLeft: 2 }}>{t('common.pts')}</span></span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[
                      { label: t('game.location'), score: myResult.locScore, sub: myResult.distKm < 1 ? '<1 km' : `${Math.round(myResult.distKm)} km`, pct: Math.round(myResult.locScore / 5) },
                      { label: t('game.year'), score: myResult.yrScore, sub: myResult.yrDiff === 0 ? t('daily.exact') : t('game.yearOff', { n: myResult.yrDiff }), pct: Math.round(myResult.yrScore / 5) },
                    ].map(item => (
                      <div key={item.label} style={{ background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: '8px 10px' }}>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 3px' }}>{item.label}</p>
                        <p style={{ fontSize: 16, fontWeight: 500, margin: '0 0 5px', lineHeight: 1 }}>{item.score.toLocaleString(currentLocale())}</p>
                        <div style={{ height: 2, background: 'rgba(42,31,23,0.1)', borderRadius: 999, overflow: 'hidden', marginBottom: 3 }}>
                          <div style={{ width: `${item.pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }}/>
                        </div>
                        <p style={{ fontSize: 10, color: 'var(--ink-3)', margin: 0 }}>{item.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Žebříček kola */}
              {sortedByRound.map((a, i) => {
                const isMe = a.user_id === user?.id
                const pName = (a.profiles as { username?: string | null })?.username ?? t('daily.player')
                return (
                  <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: isMe ? 'rgba(39,174,96,0.06)' : 'var(--paper-100)', border: isMe ? '0.5px solid rgba(39,174,96,0.2)' : '0.5px solid var(--line)' }}>
                    <span style={{ fontSize: 15, width: 22, textAlign: 'center' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{i + 1}.</span>}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: isMe ? 500 : 400 }}>
                      {pName}{isMe && <span style={{ fontSize: 10, color: '#1d6b3a', marginLeft: 6 }}>{t('lobby.you')}</span>}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginRight: 6 }}>+{a.round_score.toLocaleString(currentLocale())}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: isMe ? 600 : 400 }}>{a.round_score.toLocaleString(currentLocale())}</span>
                  </div>
                )
              })}
            </div>
          )}

          {activeTab === 'total' && (
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sortedByTotal.map((p, i) => {
                const isMe = p.user_id === user?.id
                const maxScore = sortedByTotal[0]?.total_score || 1
                return (
                  <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: isMe ? 'rgba(39,174,96,0.06)' : 'var(--paper-100)', border: isMe ? '0.5px solid rgba(39,174,96,0.2)' : '0.5px solid var(--line)' }}>
                    <span style={{ fontSize: 15, width: 22, textAlign: 'center' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{i + 1}.</span>}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: isMe ? 500 : 400 }}>
                      {p.username}{isMe && <span style={{ fontSize: 10, color: '#1d6b3a', marginLeft: 6 }}>{t('lobby.you')}</span>}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: isMe ? 600 : 400, color: isMe ? '#1d6b3a' : 'var(--ink)' }}>{p.total_score.toLocaleString(currentLocale())}</span>
                      <div style={{ width: 60, height: 3, background: 'rgba(42,31,23,0.1)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${(p.total_score / maxScore) * 100}%`, height: '100%', background: isMe ? '#1d6b3a' : 'var(--line-strong)', borderRadius: 999 }}/>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Playing ───────────────────────────────────────────
  if (phase === 'playing' && event) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0d0906', position: 'relative', overflow: 'hidden' }}>

        {/* Tenký proužek času nahoře */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'rgba(0,0,0,0.18)', zIndex: 26 }}>
          <div ref={barRef} style={{ height: '100%', background: timerColor }}/>
        </div>

        {/* Plovoucí skleněný HUD */}
        <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top,0px) + 12px)', left: 0, right: 0, zIndex: 25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0 14px', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', minWidth: 0, maxWidth: '58%', borderRadius: 16, padding: '6px 14px', background: 'rgba(246,240,230,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.5)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em', color: 'var(--accent-deep)', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isBR ? `☠️ ${t('lobby.brAlive')}: ${aliveCount}` : t('mp.roundPlayers', { n: currentRound?.round_number, total: room?.settings.rounds, count: players.length })}
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: '#26211C', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eventTitle(event)}</div>
          </div>
          <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 6, height: 38, borderRadius: 20, padding: '0 14px', background: 'rgba(246,240,230,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: timerColor, transition: 'color 500ms' }}>
            ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
        </div>

        {/* Panorama — celá plocha */}
        <div style={{ flex: 1, position: 'relative' }}>
          <PanoramaViewer url={event.panorama_url} preview={event.preview_url}/>
        </div>

        {/* Vyřazený hráč jen sleduje */}
        {amEliminated && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20, padding: '14px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', background: 'rgba(13,9,6,0.85)', backdropFilter: 'blur(8px)', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--on-dark)' }}>☠️ {t('lobby.brSpectating')}</div>
          </div>
        )}

        {/* Ovládací dock (dle #1b) */}
        {!mapExpanded && !yearExpanded && !amEliminated && (
          <ControlDock set={guessLat !== null} guessYear={guessYear} guessYearSet={guessYearSet}
            canSubmit={!!canSubmit} submitLabel={t('game.submit')}
            onMap={() => setMapExpanded(true)} onYear={() => setYearExpanded(true)}
            onSubmit={() => event && doSubmit(event, guessLat, guessLng, guessYear, guessYearSet)}/>
        )}

        {/* Rozbalená mapa */}
        {mapExpanded && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <GuessMap guessLat={guessLat} guessLng={guessLng} onGuess={(lat, lng) => { setGuessLat(lat); setGuessLng(lng) }}/>
              <button onClick={() => setMapExpanded(false)} aria-label={t('daily.collapse')} style={{ position: 'absolute', top: 'calc(10px + env(safe-area-inset-top,0px))', right: 10, zIndex: 10, width: 40, height: 40, borderRadius: '50%', background: 'rgba(13,9,6,0.72)', backdropFilter: 'blur(8px)', border: '1px solid rgba(245,241,232,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, lineHeight: 1, color: 'rgba(245,241,232,0.95)', cursor: 'pointer' }}>×</button>
              <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(13,9,6,0.7)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: '6px 12px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: timerColor, fontWeight: 600 }}>{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>
              </div>
            </div>
            <div style={{ background: 'rgba(245,241,232,0.97)', padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: '0.5px solid var(--line)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{guessLat !== null ? `${guessLat.toFixed(1)}° · ${guessLng?.toFixed(1)}° ✓` : t('game.clickMap')}</span>
              <button onClick={() => setMapExpanded(false)} style={{ background: guessLat !== null ? 'var(--accent)' : 'var(--paper-400)', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 14, fontWeight: 500, color: guessLat !== null ? '#fff' : 'var(--ink-3)', cursor: 'pointer' }}>
                {guessLat !== null ? t('game.confirmPlace') : t('game.pickPlace')}
              </button>
            </div>
          </div>
        )}

        {/* Rozbalený rok */}
        {yearExpanded && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(13,9,6,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', background: 'var(--paper-50)', borderRadius: '20px 20px 0 0', padding: '20px 18px', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 44, letterSpacing: '-0.03em', lineHeight: 1 }}>{Math.abs(guessYear) || '?'}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.14em', color: 'var(--ink-3)', marginTop: 3, textTransform: 'uppercase' }}>{guessYear < 0 ? t('daily.bc') : t('game.ad')}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: timerColor, fontWeight: 600 }}>{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</div>
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

  // Loading
  return (
    <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sepia-900)' }}>
      <span className="spinner" style={{ width: 28, height: 28, borderTopColor: 'var(--accent)' }}/>
    </div>
  )
}

// ── Panorama viewer ────────────────────────────────────────
function PanoramaViewer({ url, preview }: { url: string; preview?: string | null }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current || !url || url === 'pending') return
    let v: { destroy: () => void } | null = null
    try {
      v = pannellum.viewer(ref.current, {
        type: 'equirectangular', panorama: url, autoLoad: true, showControls: false, hfov: 140, maxHfov: 140,
        ...(preview ? { preview } : {}),
      })
    } catch {}
    return () => { v?.destroy() }
  }, [url, preview])
  return <div ref={ref} style={{ width: '100%', height: '100%' }}/>
}

// ── Year picker ────────────────────────────────────────────
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
          <div style={{ width: `${zeroPct}%`, background: 'linear-gradient(90deg,#5a8fb5,#9bbdd4)' }}/><div style={{ flex: 1, background: 'linear-gradient(90deg,#e8b49a,#d97757)' }}/>
        </div>
        <div style={{ position: 'absolute', top: 15, left: `${zeroPct}%`, width: 2, height: 18, background: 'rgba(42,31,23,0.3)', transform: 'translateX(-50%)', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', top: 9, left: `${pct}%`, transform: 'translateX(-50%)', width: 30, height: 30, borderRadius: '50%', background: 'var(--paper-50)', border: `3px solid ${value < 0 ? '#7aa8cc' : '#d97757'}`, boxShadow: `0 0 0 4px ${value < 0 ? 'rgba(90,143,181,0.2)' : 'rgba(217,119,87,0.2)'}`, pointerEvents: 'none' }}/>
        <input type="range" min={MIN} max={MAX} value={value} step={1} onChange={e => { let v = parseInt(e.target.value); if (v === 0) v = -1; onChange(v) }} style={{ position: 'absolute', inset: 0, width: '100%', height: 48, opacity: 0, cursor: 'pointer', margin: 0, touchAction: 'none' }}/>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
        <span style={{ color: '#7aa8cc' }}>{t('game.bcAxis')}</span><span style={{ color: 'var(--ink-3)' }}>0</span><span style={{ color: '#d97757' }}>2025</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
        {([-10,-1,1,10] as const).map(d => (
          <button key={d} onClick={() => step(d)} style={{ padding: '12px 0', borderRadius: 9, border: '0.5px solid var(--line-strong)', background: 'var(--paper-100)', fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--ink)', cursor: 'pointer' }}>
            {d > 0 ? `+${d}` : d}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Score karta ────────────────────────────────────────────
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
