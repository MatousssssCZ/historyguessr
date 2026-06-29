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

/** Pošle e-mail s odkazem na reset hesla */
export async function requestPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
}

/** Nastaví nové heslo (po kliknutí na odkaz z e-mailu) */
export async function updatePassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword })
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
const MAX_HISTORY = 5000  // strop proti nekonečnému růstu (drž celou „kartu")

function getPlayedIds(): string[] {
  try { return JSON.parse(localStorage.getItem(PLAYED_KEY) ?? '[]') } catch { return [] }
}

function setPlayedIds(ids: string[]) {
  try { localStorage.setItem(PLAYED_KEY, JSON.stringify(ids.slice(-MAX_HISTORY))) } catch { /* ignore */ }
}

function addPlayedIds(ids: string[]) {
  setPlayedIds([...getPlayedIds(), ...ids])
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

/**
 * Vybere `count` událostí jako z „balíčku karet":
 * než se událost zopakuje, projdou se všechny ostatní z dané (vyfiltrované)
 * množiny. Ručně vyloučené (excludeIds) se nikdy nenabídnou.
 */
export async function getRandomEvents(count = 5, filters?: EventFilters): Promise<Event[]> {
  // 1) Načti ID celé způsobilé množiny (filtry + bez ručně vyloučených)
  let idQuery = applyEventFilters(
    supabase.from('events').select('id').eq('published', true),
    filters,
  )
  if (filters?.excludeIds?.length) {
    idQuery = idQuery.not('id', 'in', `(${filters.excludeIds.join(',')})`)
  }
  const { data: idRows } = await idQuery.limit(5000)
  const pool = (idRows ?? []).map(r => (r as { id: string }).id)
  if (pool.length < count) return []

  // 2) „Balíček": ber přednostně nezahrané; když dojdou, zamíchej znovu
  const poolSet = new Set(pool)
  const seen = new Set(getPlayedIds())
  let unseen = pool.filter(id => !seen.has(id))

  if (unseen.length < count) {
    // Celá tato množina projeta → nový cyklus (zapomeň jen tyto ID, ostatní ponech)
    setPlayedIds(getPlayedIds().filter(id => !poolSet.has(id)))
    unseen = [...pool]
  }

  const selectedIds = shuffleArray(unseen).slice(0, count)
  addPlayedIds(selectedIds)

  // 3) Načti plné řádky a seřaď je dle pořadí výběru
  const { data } = await supabase.from('events').select('*').in('id', selectedIds)
  const byId = new Map((data ?? []).map(e => [(e as Event).id, e as Event]))
  return selectedIds.map(id => byId.get(id)).filter(Boolean) as Event[]
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

/** Doplňkové obrázky publikovaných událostí (jen ty s nahraným obrázkem) */
export async function getEventImages(limit = 60): Promise<string[]> {
  const { data } = await supabase
    .from('events')
    .select('event_image_url')
    .eq('published', true)
    .not('event_image_url', 'is', null)
    .limit(limit)
  return (data ?? [])
    .map(r => (r as { event_image_url: string | null }).event_image_url)
    .filter((u): u is string => !!u)
}

/**
 * Převede veřejnou Storage URL na zmenšenou (render/image) variantu — výrazně
 * menší přenos pro náhledy/hero. Pokud projekt transformace nepodporuje, render
 * endpoint vrátí chybu → volající má fallback na originální URL.
 */
export function transformedImageUrl(publicUrl: string, opts: { width?: number; quality?: number } = {}): string {
  try {
    const u = new URL(publicUrl)
    if (!u.pathname.includes('/storage/v1/object/public/')) return publicUrl
    u.pathname = u.pathname.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    if (opts.width) u.searchParams.set('width', String(opts.width))
    if (opts.quality) u.searchParams.set('quality', String(opts.quality))
    return u.toString()
  } catch { return publicUrl }
}

/** Velikost panoramatu a ilustrace dané události v bajtech (z metadat Storage). */
export async function getEventFileSizes(eventId: string): Promise<{ panorama: number | null; illustration: number | null }> {
  let panorama: number | null = null
  let illustration: number | null = null
  try {
    const { data } = await supabase.storage.from('panorama').list(eventId)
    if (data) {
      const main = data.filter(f => !f.name.includes('preview'))
      const sum = main.reduce((s, f) => s + ((f as { metadata?: { size?: number } }).metadata?.size ?? 0), 0)
      panorama = sum || null
    }
  } catch { /* ignore */ }
  try {
    const { data } = await supabase.storage.from('events').list(eventId)
    if (data) {
      const sum = data.reduce((s, f) => s + ((f as { metadata?: { size?: number } }).metadata?.size ?? 0), 0)
      illustration = sum || null
    }
  } catch { /* ignore */ }
  return { panorama, illustration }
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
  // Smaž všechny soubory ve složce události z obou bucketů (názvy nejsou pevné).
  for (const bucket of ['panorama', 'events'] as const) {
    try {
      const { data: files } = await supabase.storage.from(bucket).list(id)
      if (files && files.length) {
        await supabase.storage.from(bucket).remove(files.map(f => `${id}/${f.name}`))
      }
    } catch { /* mazání souborů nesmí zablokovat smazání záznamu */ }
  }

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

export interface SessionRow { rounds: RoundResult[]; total_score: number; finished_at: string }

/** Dohrané hry uživatele (pro statistiky), seřazené chronologicky */
export async function getUserSessions(userId: string): Promise<SessionRow[]> {
  const { data } = await supabase
    .from('game_sessions')
    .select('rounds, total_score, finished_at')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: true })
  return (data ?? []) as SessionRow[]
}

/** Výsledky denních výzev uživatele (pro sérii a počet) */
export async function getUserDailyResults(userId: string): Promise<{ score: number; date: string }[]> {
  const { data } = await supabase
    .from('daily_results')
    .select('score, date')
    .eq('user_id', userId)
    .order('date', { ascending: true })
  return (data ?? []) as { score: number; date: string }[]
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

/** Zaznamená zahrané skóre kola k události (pro statistiky obtížnosti) */
export async function recordEventScore(eventId: string, locationScore: number, yearScore: number) {
  if (!eventId) return
  await supabase.rpc('record_event_score', {
    p_event_id: eventId,
    p_location: Math.round(locationScore),
    p_year: Math.round(yearScore),
  })
}

/** Započte „úspěšné kolo" (skóre >= 950) do achievementů dané kategorie */
export async function recordCategoryHit(eventId: string, roundScore: number) {
  if (!eventId || roundScore < 950) return
  await supabase.rpc('record_category_hit', { p_event_id: eventId, p_round_score: roundScore })
}

/** Počty úspěšných kol (>=950) po kategoriích pro hráče */
export async function getCategoryHits(userId: string): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('user_category_hits')
    .select('category, hits')
    .eq('user_id', userId)
  const m: Record<string, number> = {}
  for (const r of data ?? []) m[(r as { category: string }).category] = (r as { hits: number }).hits
  return m
}

// ─── Přátelé ──────────────────────────────────────────────

export interface Friend { id: string; username: string | null; xp: number }
export type FriendRequestResult =
  | 'sent' | 'accepted' | 'pending' | 'already_friends' | 'self' | 'not_found' | 'unauthorized' | 'error'

export async function sendFriendRequest(username: string): Promise<FriendRequestResult> {
  const { data, error } = await supabase.rpc('send_friend_request', { p_username: username })
  if (error) return 'error'
  return (data as FriendRequestResult) ?? 'error'
}

export async function respondFriendRequest(requesterId: string, accept: boolean) {
  await supabase.rpc('respond_friend_request', { p_requester: requesterId, p_accept: accept })
}

export async function removeFriend(friendId: string) {
  await supabase.rpc('remove_friend', { p_friend_id: friendId })
}

export async function getFriends(): Promise<Friend[]> {
  const { data } = await supabase.rpc('get_friends')
  return (data ?? []) as Friend[]
}

export async function getFriendRequests(): Promise<Friend[]> {
  const { data } = await supabase.rpc('get_friend_requests')
  return (data ?? []) as Friend[]
}

// ─── Reporting (admin) ────────────────────────────────────

export interface DailySeriesRow { day: string; new_users: number; active_users: number; games: number }
export interface CategoryRow { category: string; plays: number }
export interface RankedEvent { id: string; title: string; category: string | null; play_count: number }
export interface DailyChallengeRow { day: string; players: number; avg_score: number | null }

async function reportKV(fn: string): Promise<Record<string, number>> {
  const { data } = await supabase.rpc(fn)
  const m: Record<string, number> = {}
  for (const r of (data ?? []) as { metric: string; value: number }[]) m[r.metric] = Number(r.value)
  return m
}

export const getReportOverview = () => reportKV('report_overview')
export const getReportMultiplayer = () => reportKV('report_multiplayer')

export async function getReportDailySeries(days: number): Promise<DailySeriesRow[]> {
  const { data } = await supabase.rpc('report_daily_series', { p_days: days })
  return (data ?? []) as DailySeriesRow[]
}
export async function getReportCategories(): Promise<CategoryRow[]> {
  const { data } = await supabase.rpc('report_categories')
  return ((data ?? []) as { category: string; plays: number }[]).map(r => ({ category: r.category, plays: Number(r.plays) }))
}
export async function getReportEventsRanked(): Promise<RankedEvent[]> {
  const { data } = await supabase.rpc('report_events_ranked')
  return (data ?? []) as RankedEvent[]
}
export async function getReportDailyChallenge(days: number): Promise<DailyChallengeRow[]> {
  const { data } = await supabase.rpc('report_daily_challenge', { p_days: days })
  return (data ?? []) as DailyChallengeRow[]
}

// ─── Ratings ──────────────────────────────────────────────

export async function addEventRating(eventId: string, rating: number) {
  return supabase.rpc('add_event_rating', {
    p_event_id: eventId,
    p_rating: rating,
  })
}

// ─── Storage ──────────────────────────────────────────────

// Bezpečný název souboru z titulu události (zachová diakritiku, odstraní znaky
// problematické pro cesty/URL, mezery → _). Výsledné názvy: "ID_Název_pano" apod.
function fileSlug(title?: string): string {
  const base = (title || 'udalost')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // odstraň diakritiku (á→a, č→c…)
    .replace(/ß/g, 'ss')
    .replace(/[^A-Za-z0-9]+/g, '_')                   // vše ostatní (mezery, znaky) → _
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
    .replace(/_+$/g, '')                              // ořež případné _ na konci po slice
  return base || 'udalost'
}

export async function uploadPanorama(file: File, eventId: string, title?: string) {
  const ext = file.name.split('.').pop()
  const path = `${eventId}/${eventId}_${fileSlug(title)}_pano.${ext}`
  const { error } = await supabase.storage
    .from('panorama')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) return { url: null, error }
  const { data } = supabase.storage.from('panorama').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

// Stáhne panorama přes SDK (ne přes veřejnou CDN URL) — spolehlivé CORS,
// vrácený Blob jde rovnou do createImageBitmap bez zašpinění canvasu.
export async function downloadPanoramaBlob(panoramaUrl: string): Promise<Blob | null> {
  try {
    const m = new URL(panoramaUrl).pathname.match(/\/storage\/v1\/object\/public\/panorama\/(.+)$/)
    if (!m) return null
    const path = decodeURIComponent(m[1])
    const { data } = await supabase.storage.from('panorama').download(path)
    return data ?? null
  } catch { return null }
}

// Stáhne doplňkový obrázek události přes SDK (spolehlivé CORS) — pro analýzu jasu
export async function downloadEventImageBlob(imageUrl: string): Promise<Blob | null> {
  try {
    const m = new URL(imageUrl).pathname.match(/\/storage\/v1\/object\/public\/events\/(.+)$/)
    if (!m) return null
    const path = decodeURIComponent(m[1])
    const { data } = await supabase.storage.from('events').download(path)
    return data ?? null
  } catch { return null }
}

// Náhled panoramatu (malý WebP) do stejného bucketu — pro okamžité zobrazení
export async function uploadPanoramaPreview(file: File, eventId: string, title?: string) {
  const path = `${eventId}/${eventId}_${fileSlug(title)}_pano_preview.webp`
  const { error } = await supabase.storage
    .from('panorama')
    .upload(path, file, { upsert: true, contentType: 'image/webp' })
  if (error) return { url: null, error }
  const { data } = supabase.storage.from('panorama').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

export async function uploadEventImage(file: File, eventId: string, title?: string) {
  const ext = file.name.split('.').pop()
  const path = `${eventId}/${eventId}_${fileSlug(title)}_ilustrace.${ext}`
  const { error } = await supabase.storage
    .from('events')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) return { url: null, error }
  const { data } = supabase.storage.from('events').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

/** Nahradí ilustrační obrázek nově zkomprimovaným, uloží URL a smaže starý soubor. */
export async function recompressEventImage(
  file: File, eventId: string, title: string, oldUrl: string | null,
): Promise<{ url: string | null; error: Error | null }> {
  const { url, error } = await uploadEventImage(file, eventId, title)
  if (error || !url) return { url: null, error: (error as Error) ?? new Error('Upload selhal') }
  const { error: dbErr } = await updateEvent(eventId, { event_image_url: url })
  if (dbErr) return { url: null, error: dbErr as Error }
  if (oldUrl && oldUrl !== url) {
    try {
      const m = new URL(oldUrl).pathname.match(/\/storage\/v1\/object\/public\/events\/(.+)/)
      if (m?.[1]) await supabase.storage.from('events').remove([decodeURIComponent(m[1])])
    } catch { /* úklid není kritický */ }
  }
  return { url, error: null }
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
  title?: string,
): Promise<{ url: string | null; error: Error | null }> {
  // 1. Upload nového souboru
  const { url, error: uploadError } = await uploadPanorama(file, eventId, title)
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
    .maybeSingle()

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
    .maybeSingle()
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
    .upsert({ month, day, event_id: eventId, updated_at: new Date().toISOString() }, { onConflict: 'month,day' })
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
