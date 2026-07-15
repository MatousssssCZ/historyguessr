import { useState, useCallback } from 'react'
import type { Event, RoundResult } from '@/types/database'
import { haversineKm, roundScore, yearDiff } from '@/lib/scoring'
import { getRandomEvents, createGameSession, finishGameSession, addScoreToProfile, addXp, recordEventScore, recordCategoryHit, submitCampaignResult, track, type EventFilters } from '@/lib/supabase'
import { XP_BONUS_GAME } from '@/lib/leveling'
import { saveResume, clearResume, loadResume } from '@/lib/resume'

const DEFAULT_ROUNDS = 5

export interface GameOptions extends EventFilters {
  rounds?: number
  events?: Event[]         // pevný seznam událostí (kampaň) — přeskočí getRandomEvents
  campaignId?: string      // po dohrání odešle výsledek + spočítá ★
  campaignTitle?: string
  resume?: boolean         // pokračovat v uložené rozehrané hře
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
  campaignId: string | null
  campaignTitle: string | null
  campaignStars: number | null   // vyplní se po dohrání kampaně (0–3)
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
  campaignId: null,
  campaignTitle: null,
  campaignStars: null,
}

export function useGame(userId: string | undefined) {
  const [state, setState] = useState<GameState>(INITIAL_STATE)
  const update = (patch: Partial<GameState>) => setState(prev => ({ ...prev, ...patch }))

  const startGame = useCallback(async (options?: GameOptions) => {
    if (!userId) return
    // Nová hra (jakákoli mimo denní výzvu) → zahoď dosavadní rozehranou hru.
    clearResume(userId)
    const rounds = options?.rounds ?? DEFAULT_ROUNDS
    const filters: EventFilters = {
      categories: options?.categories,
      yearFrom: options?.yearFrom,
      yearTo: options?.yearTo,
      excludeIds: options?.excludeIds,
    }
    update({ phase: 'loading', error: null })
    // Kampaň: pevný seznam událostí; jinak náhodný výběr dle filtrů
    const fixed = options?.events
    const events = fixed ?? await getRandomEvents(rounds, filters)
    const need = fixed ? fixed.length : rounds
    if (events.length < need || events.length === 0) {
      update({ phase: 'idle', error: 'Není dostatek událostí pro zvolená kritéria. Uprav výběr nebo přidej události v admin panelu.' })
      return
    }
    const { data: sessionData, error } = await createGameSession(userId)
    if (error || !sessionData) {
      update({ phase: 'idle', error: 'Nepodařilo se spustit hru.' })
      return
    }
    const sid = (sessionData as { id: string }).id
    setState({
      ...INITIAL_STATE, phase: 'playing', totalRounds: events.length, events,
      sessionId: sid,
      campaignId: options?.campaignId ?? null, campaignTitle: options?.campaignTitle ?? null,
    })
    // Ulož rozehranou hru (jen solo, ≥2 kola) pro „Pokračovat ve hře"
    if (!options?.campaignId && events.length >= 2) {
      saveResume(userId, { events, rounds: [], totalScore: 0, totalRounds: events.length, sessionId: sid, savedAt: Date.now() })
    }
    track('game_started', { rounds: events.length, campaign_id: options?.campaignId ?? null, categories: filters.categories ?? [], year_from: filters.yearFrom, year_to: filters.yearTo }, userId)
  }, [userId])

  // Obnov rozehranou hru z localStorage; vrátí true při úspěchu
  const resumeGame = useCallback(() => {
    if (!userId) return false
    const s = loadResume(userId)
    if (!s) return false
    setState({
      ...INITIAL_STATE, phase: 'playing',
      events: s.events, totalRounds: s.totalRounds, sessionId: s.sessionId,
      currentRound: s.rounds.length, rounds: s.rounds, totalScore: s.totalScore,
    })
    return true
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

    // Ulož / ukliď rozehranou hru (jen solo, ≥2 kola)
    if (!state.campaignId && state.totalRounds >= 2 && userId) {
      if (isLast) clearResume(userId)
      else saveResume(userId, { events: state.events, rounds: newRounds, totalScore: newTotal, totalRounds: state.totalRounds, sessionId, savedAt: Date.now() })
    }

    if (isLast && sessionId && userId) {
      await finishGameSession(sessionId, newRounds, newTotal)
      await addScoreToProfile(userId, newTotal)
      // XP: body + bonus za dohranou hru
      await addXp(userId, newTotal + XP_BONUS_GAME)
      track('game_completed', { total_score: newTotal, rounds: state.totalRounds, campaign_id: state.campaignId }, userId)
      // Kampaň — odešli výsledek na server (spočítá ★, drží nejlepší)
      if (state.campaignId) {
        try {
          const res = await submitCampaignResult(state.campaignId, newTotal)
          setState(prev => ({ ...prev, campaignStars: res.stars }))
        } catch (e) { console.warn('[Campaign] submit selhal:', e) }
      }
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

  const resetGame = useCallback(() => { if (userId) clearResume(userId); setState(INITIAL_STATE) }, [userId])

  const currentEvent = state.events[state.currentRound] ?? null
  const lastRound = state.rounds[state.rounds.length - 1] ?? null
  const canSubmit = state.guessLat !== null && state.guessLng !== null && state.guessYearSet

  return {
    state, currentEvent, lastRound, canSubmit,
    startGame, resumeGame, setGuessLocation, setGuessYear,
    submitRound, nextRound, resetGame,
    roundsCount: state.totalRounds,
  }
}
