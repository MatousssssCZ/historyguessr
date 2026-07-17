import { useState, useCallback } from 'react'
import type { Event, RoundResult } from '@/types/database'
import { haversineKm, roundScore, yearDiff } from '@/lib/scoring'
import { getRandomEvents, createGameSession, submitGameSession, recordEventScore, recordCategoryHit, submitCampaignRound, completeCampaignAttempt, track, type EventFilters, type SoloGuess } from '@/lib/supabase'
import { saveResume, clearResume, loadResume } from '@/lib/resume'

const DEFAULT_ROUNDS = 5

export interface GameOptions extends EventFilters {
  rounds?: number
  events?: Event[]         // pevný seznam událostí (kampaň) — přeskočí getRandomEvents
  campaignId?: string      // po dohrání odešle výsledek + spočítá ★
  campaignTitle?: string
  attemptId?: string       // ID serverového pokusu (kampaň) — skóre počítá server
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
  attemptId: string | null
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
  attemptId: null,
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
      attemptId: options?.attemptId ?? null,
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

    // Kampaň: kolo se odesílá na server hned (idempotentně) a skóre je jeho.
    // Solo: lokální výpočet slouží jen pro plynulé UI — autoritativní přepočet
    // všech kol dělá submit_game_session při dokončení (migrace 033).
    let distKm: number
    let ydiff: number
    let scores: { location_score: number; year_score: number; round_score: number }
    if (state.campaignId && state.attemptId) {
      try {
        const r = await submitCampaignRound(state.attemptId, currentRound + 1, guessLat, guessLng, guessYear)
        distKm = r.distanceKm
        ydiff = r.yearDiff
        scores = { location_score: r.locationScore, year_score: r.yearScore, round_score: r.roundScore }
      } catch (e) {
        console.error('[Campaign] kolo se nepodařilo odeslat:', e)
        update({ error: 'Kolo se nepodařilo odeslat. Zkontroluj připojení a zkus to znovu.' })
        return
      }
    } else {
      distKm = haversineKm(guessLat, guessLng, event.lat, event.lng)
      ydiff = yearDiff(guessYear, yearFrom, yearTo)
      scores = roundScore(distKm, guessYear, yearFrom, yearTo, event.location_radius_km ?? 0)
    }

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
      // Dokončení hry — VŽDY přes server. Klient posílá jen tipy, server
      // přepočítá kola, uloží skóre a přizná XP (klient add_xp volat nesmí).
      try {
        const guesses: SoloGuess[] = newRounds.map(r => ({
          event_id: r.event_id, lat: r.guess_lat, lng: r.guess_lng, year: r.guess_year,
        }))
        const res = await submitGameSession(sessionId, guesses)
        // Autoritativní součet ze serveru (lokální je jen pro plynulé UI)
        setState(prev => ({ ...prev, totalScore: res.totalScore }))
        track('game_completed', { total_score: res.totalScore, rounds: state.totalRounds, campaign_id: state.campaignId }, userId)
      } catch (e) {
        console.error('[Game] dokončení hry selhalo:', e)
      }

      // Kampaň — dokončení je idempotentní; ★ spočítá server ze svých uložených kol
      if (state.campaignId && state.attemptId) {
        try {
          const res = await completeCampaignAttempt(state.attemptId)
          setState(prev => ({ ...prev, campaignStars: res.stars, totalScore: res.totalScore }))
          track('campaign_completed', {
            campaign_id: state.campaignId, total_score: res.totalScore,
            stars: res.stars, is_best: res.isBest,
          }, userId)
        } catch (e) { console.warn('[Campaign] dokončení selhalo:', e) }
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
