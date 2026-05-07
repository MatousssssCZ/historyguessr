import { useState, useCallback } from 'react'
import type { Event, RoundResult } from '@/types/database'
import { haversineKm, roundScore } from '@/lib/scoring'
import { getRandomEvents, createGameSession, finishGameSession, addScoreToProfile } from '@/lib/supabase'

const ROUNDS_PER_GAME = 5

export type GamePhase = 'idle' | 'loading' | 'playing' | 'round_result' | 'finished'

export interface GameState {
  phase: GamePhase
  events: Event[]
  currentRound: number        // 0-indexed
  sessionId: string | null
  rounds: RoundResult[]
  totalScore: number
  // Aktuální kolo
  guessLat: number | null
  guessLng: number | null
  guessYear: number
  error: string | null
}

const INITIAL_STATE: GameState = {
  phase: 'idle',
  events: [],
  currentRound: 0,
  sessionId: null,
  rounds: [],
  totalScore: 0,
  guessLat: null,
  guessLng: null,
  guessYear: 1900,
  error: null,
}

export function useGame(userId: string | undefined) {
  const [state, setState] = useState<GameState>(INITIAL_STATE)

  const update = (patch: Partial<GameState>) =>
    setState(prev => ({ ...prev, ...patch }))

  /** Zahájí novou hru */
  const startGame = useCallback(async () => {
    if (!userId) return
    update({ phase: 'loading', error: null })

    const events = await getRandomEvents(ROUNDS_PER_GAME)
    if (events.length < ROUNDS_PER_GAME) {
      update({ phase: 'idle', error: 'Není dostatek událostí. Přidej je v admin panelu.' })
      return
    }

    const { data: session, error } = await createGameSession(userId)
    if (error || !session) {
      update({ phase: 'idle', error: 'Nepodařilo se spustit hru.' })
      return
    }

    setState({
      ...INITIAL_STATE,
      phase: 'playing',
      events,
      sessionId: (session as { id: string }).id,
    })
  }, [userId])

  /** Nastaví tip polohy */
  const setGuessLocation = useCallback((lat: number, lng: number) => {
    update({ guessLat: lat, guessLng: lng })
  }, [])

  /** Nastaví tip roku */
  const setGuessYear = useCallback((year: number) => {
    update({ guessYear: year })
  }, [])

  /** Odešle odpověď pro aktuální kolo */
  const submitRound = useCallback(async () => {
    const { events, currentRound, guessLat, guessLng, guessYear, rounds, sessionId } = state
    if (guessLat === null || guessLng === null) return

    const event = events[currentRound]
    const distKm = haversineKm(guessLat, guessLng, event.lat, event.lng)
    const yearDiff = Math.abs(guessYear - event.year)
    const scores = roundScore(distKm, yearDiff)

    const roundResult: RoundResult = {
      event_id: event.id,
      guess_lat: guessLat,
      guess_lng: guessLng,
      guess_year: guessYear,
      distance_km: distKm,
      year_diff: yearDiff,
      ...scores,
    }

    const newRounds = [...rounds, roundResult]
    const newTotal = newRounds.reduce((s, r) => s + r.round_score, 0)
    const isLast = currentRound === ROUNDS_PER_GAME - 1

    setState(prev => ({
      ...prev,
      rounds: newRounds,
      totalScore: newTotal,
      phase: isLast ? 'round_result' : 'round_result', // vždy round_result nejdříve
    }))

    // Pokud poslední kolo, uložíme výsledek do DB
    if (isLast && sessionId && userId) {
      await finishGameSession(sessionId, newRounds, newTotal)
      await addScoreToProfile(userId, newTotal)
    }
  }, [state, userId])

  /** Přechod na další kolo */
  const nextRound = useCallback(() => {
    const { currentRound, rounds } = state
    const isLast = currentRound === ROUNDS_PER_GAME - 1

    if (isLast) {
      update({ phase: 'finished' })
    } else {
      update({
        phase: 'playing',
        currentRound: currentRound + 1,
        guessLat: null,
        guessLng: null,
        guessYear: 1900,
      })
    }
  }, [state])

  /** Reset hry */
  const resetGame = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  const currentEvent = state.events[state.currentRound] ?? null
  const lastRound = state.rounds[state.rounds.length - 1] ?? null
  const canSubmit = state.guessLat !== null && state.guessLng !== null

  return {
    state,
    currentEvent,
    lastRound,
    canSubmit,
    startGame,
    setGuessLocation,
    setGuessYear,
    submitRound,
    nextRound,
    resetGame,
    roundsCount: ROUNDS_PER_GAME,
  }
}
