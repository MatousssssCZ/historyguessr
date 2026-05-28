import { useState, useCallback } from 'react'
import type { Event, RoundResult } from '@/types/database'
import { haversineKm, roundScore, yearDiff } from '@/lib/scoring'
import { getRandomEvents, createGameSession, finishGameSession, addScoreToProfile } from '@/lib/supabase'

const ROUNDS_PER_GAME = 5

export type GamePhase = 'idle' | 'loading' | 'playing' | 'round_result' | 'finished'

export interface GameState {
  phase: GamePhase
  events: Event[]
  currentRound: number
  sessionId: string | null
  rounds: RoundResult[]
  totalScore: number
  guessLat: number | null
  guessLng: number | null
  guessYear: number
  guessYearSet: boolean
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
  guessYear: 0,
  guessYearSet: false,
  error: null,
}

export function useGame(userId: string | undefined) {
  const [state, setState] = useState<GameState>(INITIAL_STATE)
  const update = (patch: Partial<GameState>) => setState(prev => ({ ...prev, ...patch }))

  const startGame = useCallback(async () => {
    if (!userId) return
    update({ phase: 'loading', error: null })
    const events = await getRandomEvents(ROUNDS_PER_GAME)
    if (events.length < ROUNDS_PER_GAME) {
      update({ phase: 'idle', error: 'Není dostatek událostí. Přidej je v admin panelu.' })
      return
    }
    const { data: sessionData, error } = await createGameSession(userId)
    if (error || !sessionData) {
      update({ phase: 'idle', error: 'Nepodařilo se spustit hru.' })
      return
    }
    setState({ ...INITIAL_STATE, phase: 'playing', events, sessionId: (sessionData as { id: string }).id })
  }, [userId])

  const setGuessLocation = useCallback((lat: number, lng: number) => {
    update({ guessLat: lat, guessLng: lng })
  }, [])

  const setGuessYear = useCallback((year: number) => {
    update({ guessYear: year, guessYearSet: true })
  }, [])

  // Prefetch panoramy dalšího kola na pozadí
  const prefetchNext = useCallback((events: Event[], currentRound: number) => {
    const nextEvent = events[currentRound + 1]
    if (!nextEvent?.panorama_url) return
    const img = new Image()
    img.src = nextEvent.panorama_url
  }, [])

  const submitRound = useCallback(async () => {
    const { events, currentRound, guessLat, guessLng, guessYear, rounds, sessionId } = state
    if (guessLat === null || guessLng === null) return

    const event = events[currentRound]
    const yearFrom = event.year_from ?? event.year
    const yearTo = event.year_to ?? event.year
    const distKm = haversineKm(guessLat, guessLng, event.lat, event.lng)
    const ydiff = yearDiff(guessYear, yearFrom, yearTo)
    const scores = roundScore(distKm, guessYear, yearFrom, yearTo, event.location_radius_km ?? 0)

    const roundResult: RoundResult = {
      event_id: event.id,
      guess_lat: guessLat,
      guess_lng: guessLng,
      guess_year: guessYear,
      distance_km: distKm,
      year_diff: ydiff,
      ...scores,
    }

    const newRounds = [...rounds, roundResult]
    const newTotal = newRounds.reduce((s, r) => s + r.round_score, 0)
    const isLast = currentRound === ROUNDS_PER_GAME - 1

    setState(prev => ({ ...prev, rounds: newRounds, totalScore: newTotal, phase: 'round_result' }))

    // Prefetchni panoramu dalšího kola na pozadí
    prefetchNext(state.events, currentRound)

    if (isLast && sessionId && userId) {
      await finishGameSession(sessionId, newRounds, newTotal)
      await addScoreToProfile(userId, newTotal)
    }
  }, [state, userId])

  const nextRound = useCallback(() => {
    const { currentRound } = state
    const isLast = currentRound === ROUNDS_PER_GAME - 1
    if (isLast) {
      update({ phase: 'finished' })
    } else {
      update({
        phase: 'playing',
        currentRound: currentRound + 1,
        guessLat: null,
        guessLng: null,
        guessYear: 0,
        guessYearSet: false,
      })
    }
  }, [state])

  const resetGame = useCallback(() => setState(INITIAL_STATE), [])

  const currentEvent = state.events[state.currentRound] ?? null
  const lastRound = state.rounds[state.rounds.length - 1] ?? null
  const canSubmit = state.guessLat !== null && state.guessLng !== null && state.guessYearSet

  return {
    state, currentEvent, lastRound, canSubmit,
    startGame, setGuessLocation, setGuessYear,
    submitRound, nextRound, resetGame,
    roundsCount: ROUNDS_PER_GAME,
  }
}
