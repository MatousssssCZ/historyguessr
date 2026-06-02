import { createClient } from '@supabase/supabase-js'
import type { Event, EventInsert, EventUpdate, Profile, RoundResult } from '@/types/database'
import { XP_BONUS_DAILY } from './leveling'

export interface DailyResult {
  id: string
  user_id: string
  date: string
  score: number
  guess_lat: number | null
  guess_lng: number | null
  guess_year: number | null
  created_at: string
  profiles?: { username: string | null }
}

export interface DailyAssignment {
  month: number
  day: number
  event_id: string | null
  events?: Event
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

// ─── Auth ─────────────────────────────────────────────────

export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  })
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

// ─── Profiles ─────────────────────────────────────────────

export async function getProfile(userId: string) {
  return supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
}

export async function updateProfile(userId: string, updates: { username?: string; avatar_url?: string }) {
  return supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
}

// ─── Events ───────────────────────────────────────────────

// Klíč do localStorage pro historii zahraných událostí
const PLAYED_KEY = 'hg_played_ids'
const MAX_HISTORY = 50  // pamatujeme max 50 posledních

function getPlayedIds(): string[] {
  try { return JSON.parse(localStorage.getItem(PLAYED_KEY) ?? '[]') } catch { return [] }
}

function addPlayedIds(ids: string[]) {
  const prev = getPlayedIds()
  const next = [...prev, ...ids].slice(-MAX_HISTORY)  // drž max 50
  localStorage.setItem(PLAYED_KEY, JSON.stringify(next))
}

export interface EventFilters {
  categories?: string[]
  yearFrom?: number
  yearTo?: number
  excludeIds?: string[]
}

/** Aplikuje filtry předsálí na dotaz nad tabulkou events */
function applyEventFilters<T>(query: T, filters?: EventFilters): T {
  let q = query as any
  if (filters?.categories?.length) q = q.in('category', filters.categories)
  if (typeof filters?.yearFrom === 'number') q = q.gte('year', filters.yearFrom)
  if (typeof filters?.yearTo === 'number') q = q.lte('year', filters.yearTo)
  return q as T
}

/** Sestaví seznam ID, které se mají z losování vynechat (zahrané + ručně vyloučené) */
function buildExcludeList(extra?: string[]): string {
  const ids = [...getPlayedIds(), ...(extra ?? [])]
  return ids.length > 0 ? ids.join(',') : '00000000-0000-0000-0000-000000000000'
}

export async function getRandomEvents(count = 5, filters?: EventFilters): Promise<Event[]> {
  // Nejdřív zkus vzít pouze neozkoušené (a nevyloučené) eventy
  const { data: fresh } = await applyEventFilters(
    supabase
      .from('events')
      .select('*')
      .eq('published', true)
      .not('id', 'in', `(${buildExcludeList(filters?.excludeIds)})`),
    filters,
  )
    .order('play_count', { ascending: true })  // méně hrané mají přednost
    .limit(count * 8)  // větší pool pro lepší náhodnost

  let pool = fresh ?? []

  // Pokud nemáme dost, doplň ze zahraných (ručně vyloučené ale respektuj vždy)
  if (pool.length < count) {
    let fb = applyEventFilters(
      supabase.from('events').select('*').eq('published', true),
      filters,
    )
    if (filters?.excludeIds?.length) {
      fb = fb.not('id', 'in', `(${filters.excludeIds.join(',')})`)
    }
    const { data: fallback } = await fb
      .order('play_count', { ascending: true })
      .limit(count * 4)
    const extra = (fallback ?? []).filter(e => !pool.find(p => p.id === e.id))
    pool = [...pool, ...extra]
  }

  if (pool.length < count) return []

  const selected = shuffleArray(pool).slice(0, count) as Event[]
  addPlayedIds(selected.map(e => e.id))
  return selected
}

export interface CandidateEvent {
  id: string
  title: string
  year: number
  category: string | null
}

/** Načte seznam událostí odpovídajících filtrům (pro „vyladit" v předsálí) */
export async function getCandidateEvents(filters?: EventFilters): Promise<CandidateEvent[]> {
  const { data } = await applyEventFilters(
    supabase.from('events').select('id, title, year, category').eq('published', true),
    filters,
  )
    .order('year', { ascending: true })
    .limit(500)
  return (data ?? []) as CandidateEvent[]
}

export async function getAdminEvents() {
  return supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
}

export async function createEvent(event: EventInsert) {
  return supabase
    .from('events')
    .insert(event)
    .select()
    .single()
}

export async function updateEvent(id: string, updates: EventUpdate) {
  return supabase
    .from('events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
}

export async function deleteEvent(id: string) {
  // Smaž soubory ze Storage (panorama + event image)
  // Zkusíme všechny možné přípony
  const extensions = ['jpg', 'jpeg', 'png', 'webp']
  const panoramaPaths = extensions.map(ext => `${id}/panorama.${ext}`)
  const coverPaths = extensions.map(ext => `${id}/cover.${ext}`)

  await supabase.storage.from('panorama').remove(panoramaPaths)
  await supabase.storage.from('events').remove(coverPaths)

  // Smaž záznam z DB
  return supabase.from('events').delete().eq('id', id)
}

export async function togglePublished(id: string, published: boolean) {
  return updateEvent(id, { published })
}

// ─── Game sessions ─────────────────────────────────────────

export async function createGameSession(userId: string) {
  return supabase
    .from('game_sessions')
    .insert({ user_id: userId, rounds: [] })
    .select()
    .single()
}

export async function finishGameSession(sessionId: string, rounds: RoundResult[], totalScore: number) {
  return supabase
    .from('game_sessions')
    .update({
      finished_at: new Date().toISOString(),
      rounds: rounds as unknown[],
      total_score: totalScore,
    })
    .eq('id', sessionId)
    .select()
    .single()
}

export async function addScoreToProfile(userId: string, score: number) {
  return supabase.rpc('increment_user_score', {
    p_user_id: userId,
    p_score: score,
  })
}

/** Přičte XP hráči (atomicky přes RPC; tiše ignoruje chybu) */
export async function addXp(userId: string, amount: number) {
  if (!userId || amount <= 0) return
  await supabase.rpc('add_xp', { p_user_id: userId, p_amount: Math.round(amount) })
}

// ─── Ratings ──────────────────────────────────────────────

export async function addEventRating(eventId: string, rating: number) {
  return supabase.rpc('add_event_rating', {
    p_event_id: eventId,
    p_rating: rating,
  })
}

// ─── Storage ──────────────────────────────────────────────

export async function uploadPanorama(file: File, eventId: string) {
  const ext = file.name.split('.').pop()
  const path = `${eventId}/panorama.${ext}`
  const { error } = await supabase.storage
    .from('panorama')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) return { url: null, error }
  const { data } = supabase.storage.from('panorama').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

export async function uploadEventImage(file: File, eventId: string) {
  const ext = file.name.split('.').pop()
  const path = `${eventId}/cover.${ext}`
  const { error } = await supabase.storage
    .from('events')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) return { url: null, error }
  const { data } = supabase.storage.from('events').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

// ─── Analytics ───────────────────────────────────────────

export async function track(
  eventName: string,
  properties: Record<string, unknown> = {},
  userId?: string,
) {
  try {
    await supabase.from('analytics_events').insert({
      user_id: userId ?? null,
      event_name: eventName,
      properties,
    })
  } catch {
    // Analytics nikdy nesmí rozbít UI — tiché selhání
  }
}

// ─── Storage — bezpečné nahrazení panoramy ────────────────

/**
 * Nahraje novou panoramu a smaže starou.
 * Bezpečný flow:
 *   1. Upload nového souboru
 *   2. Update DB
 *   3. Smaž starý soubor (selhání nevadí — jen logujeme)
 */
export async function uploadPanoramaWithCleanup(
  file: File,
  eventId: string,
  oldPanoramaUrl: string | null,
): Promise<{ url: string | null; error: Error | null }> {
  // 1. Upload nového souboru
  const { url, error: uploadError } = await uploadPanorama(file, eventId)
  if (uploadError || !url) {
    return { url: null, error: uploadError as Error ?? new Error('Upload selhal') }
  }

  // 2. Update DB
  const { error: dbError } = await updateEvent(eventId, { panorama_url: url })
  if (dbError) {
    return { url: null, error: dbError as Error }
  }

  // 3. Smaž starý soubor — selhání je OK
  if (oldPanoramaUrl && oldPanoramaUrl !== 'pending' && oldPanoramaUrl !== url) {
    try {
      // Extrahuj path ze Storage URL
      const urlObj = new URL(oldPanoramaUrl)
      const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/panorama\/(.+)/)
      if (pathMatch?.[1]) {
        const { error: deleteError } = await supabase.storage
          .from('panorama')
          .remove([decodeURIComponent(pathMatch[1])])
        if (deleteError) {
          console.warn('[Storage] Smazání staré panoramy selhalo:', deleteError.message)
          track('panorama_delete_failed', { event_id: eventId, old_url: oldPanoramaUrl, error: deleteError.message })
        } else {
          track('panorama_replaced', { event_id: eventId })
        }
      }
    } catch (e) {
      console.warn('[Storage] Chyba při mazání staré panoramy:', e)
    }
  }

  return { url, error: null }
}

// ─── Daily Challenge ──────────────────────────────────────

/** Načte událost pro dnešní den (podle měsíce a dne) */
export async function getDailyChallenge(): Promise<Event | null> {
  const today = new Date()
  const month = today.getMonth() + 1
  const day = today.getDate()

  const { data } = await supabase
    .from('daily_challenge_assignments')
    .select('event_id, events(*)')
    .eq('month', month)
    .eq('day', day)
    .single()

  if (!data?.event_id || !data?.events) return null
  return data.events as unknown as Event
}

/** Vrátí výsledek hráče pro dnešní den (pokud již hrál) */
export async function getTodayDailyResult(userId: string): Promise<DailyResult | null> {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('daily_results')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single()
  return data ?? null
}

/** Uloží výsledek hráče pro dnešní den */
export async function saveDailyResult(
  userId: string,
  score: number,
  guessLat: number,
  guessLng: number,
  guessYear: number,
): Promise<{ error: Error | null }> {
  const today = new Date().toISOString().split('T')[0]
  const { error } = await supabase.from('daily_results').insert({
    user_id: userId,
    date: today,
    score,
    guess_lat: guessLat,
    guess_lng: guessLng,
    guess_year: guessYear,
  })
  if (error) return { error: error as Error }
  // XP: skóre + bonus za denní výzvu
  await addXp(userId, score + XP_BONUS_DAILY)
  track('daily_challenge_completed', { score }, userId)
  return { error: null }
}

/** Top 10 hráčů pro dnešní den */
export async function getDailyLeaderboard(): Promise<DailyResult[]> {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('daily_results')
    .select('*, profiles(username)')
    .eq('date', today)
    .order('score', { ascending: false })
    .limit(10)
  return (data ?? []) as DailyResult[]
}

// ─── Daily Challenge Admin ────────────────────────────────

/** Načte všechna přiřazení (pro admin kalendář) */
export async function getDailyAssignments(): Promise<DailyAssignment[]> {
  const { data } = await supabase
    .from('daily_challenge_assignments')
    .select('month, day, event_id, events(id, title)')
    .order('month')
    .order('day')
  // Supabase vrací embedded `events` jako pole — narovnej na jeden objekt
  return (data ?? []).map((r: any) => ({
    ...r,
    events: Array.isArray(r.events) ? r.events[0] : r.events,
  })) as DailyAssignment[]
}

/** Přiřadí nebo odebere událost ke dni */
export async function setDailyAssignment(
  month: number,
  day: number,
  eventId: string | null,
): Promise<{ error: Error | null }> {
  if (eventId === null) {
    const { error } = await supabase
      .from('daily_challenge_assignments')
      .delete()
      .eq('month', month)
      .eq('day', day)
    return { error: error as Error | null }
  }
  const { error } = await supabase
    .from('daily_challenge_assignments')
    .upsert({ month, day, event_id: eventId, updated_at: new Date().toISOString() })
  return { error: error as Error | null }
}

// ─── Utils ────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  // Použij crypto.getRandomValues pro kryptograficky silnou náhodnost
  for (let i = a.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    const j = buf[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
