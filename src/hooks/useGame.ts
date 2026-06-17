import { useState, useCallback } from 'react'
import type { Event, RoundResult } from '@/types/database'
import { haversineKm, roundScore, yearDiff } from '@/lib/scoring'
import { getRandomEvents, createGameSession, finishGameSession, addScoreToProfile, addXp, recordEventScore, recordCategoryHit, track, type EventFilters } from '@/lib/supabase'
import { XP_BONUS_GAME } from '@/lib/leveling'

const DEFAULT_ROUNDS = 5

export interface GameOptions extends EventFilters {
  rounds?: number
}

export type GamePhase = 'idle' | 'loading' | 'playing' | 'round_result' | 'finished'

export interface GameState {
  phase: GamePhase
  events: Event[]
  currentRound: number
  totalRounds: number
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
  totalRounds: DEFAULT_ROUNDS,
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

  const startGame = useCallback(async (options?: GameOptions) => {
    if (!userId) return
    const rounds = options?.rounds ?? DEFAULT_ROUNDS
    const filters: EventFilters = {
      categories: options?.categories,
      yearFrom: options?.yearFrom,
      yearTo: options?.yearTo,
      excludeIds: options?.excludeIds,
    }
    update({ phase: 'loading', error: null })
    const events = await getRandomEvents(rounds, filters)
    if (events.length < rounds) {
      update({ phase: 'idle', error: 'Není dostatek událostí pro zvolená kritéria. Uprav výběr nebo přidej události v admin panelu.' })
      return
    }
    const { data: sessionData, error } = await createGameSession(userId)
    if (error || !sessionData) {
      update({ phase: 'idle', error: 'Nepodařilo se spustit hru.' })
      return
    }
    setState({ ...INITIAL_STATE, phase: 'playing', totalRounds: rounds, events, sessionId: (sessionData as { id: string }).id })
    track('game_started', { rounds, categories: filters.categories ?? [], year_from: filters.yearFrom, year_to: filters.yearTo }, userId)
  }, [userId])

  const setGuessLocation = useCallback((lat: number, lng: number) => {
    update({ guessLat: lat, guessLng: lng })
  }, [])

  const setGuessYear = useCallback((year: number) => {
    update({ guessYear: year, guessYearSet: true })
  }, [])

  // Prefetch panoramy dalšího kola na pozadí přes fetch (funguje pro všechny typy souborů)
  const prefetchNext = useCallback((events: Event[], currentRound: number) => {
    const nextEvent = events[currentRound + 1]
    if (!nextEvent?.panorama_url || nextEvent.panorama_url === 'pending') return
    // fetch uloží do browser cache — Pannellum pak načte okamžitě
    fetch(nextEvent.panorama_url, { method: 'GET', cache: 'force-cache' }).catch(() => {})
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
    const isLast = currentRound === state.totalRounds - 1

    // Statistika obtížnosti události + achievement po kategorii
    recordEventScore(event.id, scores.location_score, scores.year_score)
    recordCategoryHit(event.id, scores.round_score)

    setState(prev => ({ ...prev, rounds: newRounds, totalScore: newTotal, phase: 'round_result' }))

    track('guess_submitted', {
      round: currentRound + 1,
      event_id: event.id,
      distance_km: Math.round(distKm),
      year_diff: ydiff,
      round_score: scores.round_score,
    }, userId)

    // Prefetchni panoramu dalšího kola na pozadí
    prefetchNext(state.events, currentRound)

    if (isLast && sessionId && userId) {
      await finishGameSession(sessionId, newRounds, newTotal)
      await addScoreToProfile(userId, newTotal)
      // XP: body + bonus za dohranou hru
      await addXp(userId, newTotal + XP_BONUS_GAME)
      track('game_completed', { total_score: newTotal, rounds: state.totalRounds }, userId)
    }
  }, [state, userId])

  const nextRound = useCallback(() => {
    const { currentRound } = state
    const isLast = currentRound === state.totalRounds - 1
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
    roundsCount: state.totalRounds,
  }
}
