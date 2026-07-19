import { createClient } from '@supabase/supabase-js'
import type { Event, EventInsert, EventUpdate, RoundResult, CampaignCategory, Campaign, CampaignEvent, UserCampaignProgress, CampaignReward, EarnedReward } from '@/types/database'
import { FREE_ENTITLEMENTS, isPremiumUser, type Entitlements } from './entitlements'
import { isCategoryVisible, globalStars, DAILY_EXPEDITIONS } from './campaignLogic'
import { normalizeRules, type PresetRules, type SinglePlayerPreset, type SharedPreset } from './presets'

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

// ─── Oprava odkazů na panoramata ──────────────────────────
// Některé starší události mají panorama_url s příponou (.png/.jpg), ale reálný
// soubor je .webp (komprese ho převedla) → 404. Tenhle nástroj srovná DB odkazy
// se skutečnými soubory v úložišti a opraví jen ty rozbité.

export interface PanoramaRepairResult {
  total: number
  fixed: number
  problems: { id: string; title: string; note: string }[]
}

function storageFileName(url: string | null | undefined): string | null {
  if (!url || url === 'pending') return null
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || '') || null }
  catch { return null }
}

export async function repairPanoramaLinks(
  onProgress?: (done: number, total: number) => void,
): Promise<PanoramaRepairResult> {
  const { data } = await getAdminEvents()
  const events = (data ?? []) as Event[]
  const res: PanoramaRepairResult = { total: events.length, fixed: 0, problems: [] }

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]
    onProgress?.(i + 1, events.length)

    const { data: files } = await supabase.storage.from('panorama').list(ev.id)
    const list = files ?? []
    const patch: EventUpdate = {}

    // Hlavní panorama: pokud DB odkaz míří na neexistující soubor, přesměruj na
    // reálný (preferuj .webp — komprimovanou aktuální verzi).
    const curName = storageFileName(ev.panorama_url)
    const curExists = !!curName && list.some(f => f.name === curName)
    if (!curExists && ev.panorama_url && ev.panorama_url !== 'pending') {
      const cands = list.filter(f => /_pano\.(png|jpe?g|webp)$/i.test(f.name) && !/_preview/i.test(f.name))
      const pick = cands.find(f => /\.webp$/i.test(f.name)) ?? cands[0]
      if (pick) {
        patch.panorama_url = supabase.storage.from('panorama').getPublicUrl(`${ev.id}/${pick.name}`).data.publicUrl
      } else {
        res.problems.push({ id: ev.id, title: ev.title, note: 'panorama soubor v úložišti nenalezen' })
      }
    }

    // Náhled: stejná logika
    const prevName = storageFileName(ev.preview_url)
    const prevExists = !!prevName && list.some(f => f.name === prevName)
    if (!prevExists) {
      const pv = list.find(f => /_pano_preview\.webp$/i.test(f.name))
      if (pv) patch.preview_url = supabase.storage.from('panorama').getPublicUrl(`${ev.id}/${pv.name}`).data.publicUrl
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await updateEvent(ev.id, patch)
      if (error) res.problems.push({ id: ev.id, title: ev.title, note: 'zápis selhal: ' + error.message })
      else res.fixed++
    }
  }
  return res
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

export interface SoloGuess { event_id: string; lat: number | null; lng: number | null; year: number }

/**
 * Dokončí solo hru — klient posílá JEN tipy, server přepočítá všechna kola,
 * uloží je a přizná XP i skóre profilu. Idempotentní.
 */
export async function submitGameSession(sessionId: string, guesses: SoloGuess[]): Promise<{
  totalScore: number; xpAwarded: number; rounds: RoundResult[]
}> {
  const { data, error } = await supabase.rpc('submit_game_session', {
    p_session_id: sessionId, p_guesses: guesses,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return {
    totalScore: row?.total_score ?? 0,
    xpAwarded: row?.xp_awarded ?? 0,
    rounds: (row?.rounds ?? []) as RoundResult[],
  }
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


/** Pořadí hráče ve světovém žebříčku dle XP (přes RPC — RLS profilů obchází server). */
export async function getWorldRank(): Promise<{ rank: number; total: number }> {
  const { data } = await supabase.rpc('get_world_rank')
  const row = Array.isArray(data) ? data[0] : data
  return { rank: Number(row?.rank ?? 0), total: Number(row?.total ?? 0) }
}

/** Přičte XP hráči (atomicky přes RPC; tiše ignoruje chybu) */

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
/** Ze Storage veřejné URL vytáhne cestu v bucketu `panorama` (nebo null). */
function panoramaStoragePath(url: string | null | undefined): string | null {
  if (!url || url === 'pending') return null
  try {
    const m = new URL(url).pathname.match(/\/storage\/v1\/object\/public\/panorama\/(.+)/)
    return m?.[1] ? decodeURIComponent(m[1]) : null
  } catch { return null }
}

export async function uploadPanoramaWithCleanup(
  file: File,
  eventId: string,
  oldPanoramaUrl: string | null,
  title?: string,
  oldPreviewUrl?: string | null,
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

  // 3. Smaž starý panorama soubor + starý náhled — selhání je OK.
  //    Náhled má jiný název než panorama, takže když se změní titul (slug),
  //    zůstal by osiřelý. Mažeme obojí, když ukazují na jiný soubor než nový.
  const newPath = panoramaStoragePath(url)
  const toRemove = [oldPanoramaUrl, oldPreviewUrl]
    .map(panoramaStoragePath)
    .filter((p): p is string => !!p && p !== newPath)
  if (toRemove.length > 0) {
    try {
      const { error: deleteError } = await supabase.storage.from('panorama').remove(toRemove)
      if (deleteError) {
        console.warn('[Storage] Smazání starých souborů selhalo:', deleteError.message)
        track('panorama_delete_failed', { event_id: eventId, paths: toRemove, error: deleteError.message })
      } else {
        track('panorama_replaced', { event_id: eventId, removed: toRemove.length })
      }
    } catch (e) {
      console.warn('[Storage] Chyba při mazání starých souborů:', e)
    }
  }

  return { url, error: null }
}

// ─── Daily Challenge ──────────────────────────────────────

/** Načte událost pro dnešní den (podle měsíce a dne) */
/** Lokální datum YYYY-MM-DD (denní výzva běží podle lokálního dne, ne UTC). */
export function localDateISO(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

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
  const today = localDateISO()
  const { data } = await supabase
    .from('daily_results')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle()
  return data ?? null
}

/** Uloží výsledek hráče pro dnešní den */
/** Read-only: kdy hráč dnešní výzvu zahájil (null = ještě nezačal). NESPOUŠTÍ čas. */
export async function getDailyStart(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('daily_starts')
    .select('started_at')
    .eq('user_id', userId)
    .eq('date', localDateISO())
    .maybeSingle()
  return (data as { started_at?: string } | null)?.started_at ?? null
}

/** Zahájí (nebo obnoví) dnešní výzvu — čas startu drží SERVER (migrace 033). */
export async function startDailyChallenge(): Promise<{ startedAt: string | null; secondsLeft: number }> {
  const { data, error } = await supabase.rpc('start_daily_challenge', { p_date: localDateISO() })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return { startedAt: (row?.started_at as string | null) ?? null, secondsLeft: row?.seconds_left ?? 0 }
}

export interface DailySubmitResult {
  locationScore: number
  yearScore: number
  roundScore: number
  distanceKm: number
  yearDiff: number
  xpAwarded: number
}

/**
 * Odešle denní výzvu — klient posílá JEN tip, skóre i XP počítá server.
 * Idempotentní: opakované odeslání vrátí uložený výsledek bez další XP.
 */
export async function submitDailyResult(
  guessLat: number | null, guessLng: number | null, guessYear: number,
): Promise<DailySubmitResult> {
  const { data, error } = await supabase.rpc('submit_daily_result', {
    p_date: localDateISO(), p_guess_lat: guessLat, p_guess_lng: guessLng, p_guess_year: guessYear,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return {
    locationScore: row?.location_score ?? 0,
    yearScore: row?.year_score ?? 0,
    roundScore: row?.round_score ?? 0,
    distanceKm: row?.distance_km ?? 0,
    yearDiff: row?.year_diff ?? 0,
    xpAwarded: row?.xp_awarded ?? 0,
  }
}

/** Top 10 hráčů pro dnešní den */
export async function getDailyLeaderboard(): Promise<DailyResult[]> {
  const today = localDateISO()
  const { data } = await supabase
    .from('daily_results')
    .select('*, profiles(username)')
    .eq('date', today)
    .order('score', { ascending: false })
    .limit(10)
  return (data ?? []) as DailyResult[]
}

/** Žebříček dne jen z přátel (+ vlastní řádek), včetně nicků. */
export async function getDailyFriendsLeaderboard(userId: string, ownUsername: string | null): Promise<DailyResult[]> {
  const friends = await getFriends().catch(() => [] as Friend[])
  const nameById = new Map<string, string | null>()
  friends.forEach(f => nameById.set(f.id, f.username))
  nameById.set(userId, ownUsername)
  const ids = [...nameById.keys()]
  const today = localDateISO()
  const { data } = await supabase
    .from('daily_results')
    .select('id, user_id, date, score, guess_lat, guess_lng, guess_year, created_at')
    .eq('date', today)
    .in('user_id', ids)
    .order('score', { ascending: false })
  return (data ?? []).map(r => ({
    ...(r as Record<string, unknown>),
    profiles: { username: nameById.get((r as { user_id: string }).user_id) ?? null },
  })) as unknown as DailyResult[]
}

/** Všechna dnešní skóre (pro histogram — celý svět). */
export async function getDailyAllScores(): Promise<number[]> {
  const today = localDateISO()
  const { data } = await supabase.from('daily_results').select('score').eq('date', today)
  return (data ?? []).map(r => (r as { score: number }).score)
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

// ─── Kampaně (admin CRUD) ─────────────────────────────────

/** Všechny kategorie (admin — vidí i nepublikované). */
export async function getAdminCampaignCategories(): Promise<CampaignCategory[]> {
  const { data } = await supabase.from('campaign_categories').select('*').order('seq').order('created_at')
  return (data ?? []) as CampaignCategory[]
}

export async function createCampaignCategory(patch: Partial<CampaignCategory>) {
  return supabase.from('campaign_categories').insert(patch).select().single()
}

export async function updateCampaignCategory(id: string, patch: Partial<CampaignCategory>) {
  return supabase.from('campaign_categories').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function deleteCampaignCategory(id: string) {
  return supabase.from('campaign_categories').delete().eq('id', id)
}

/** Kampaně dané kategorie (admin). */
export async function getAdminCampaigns(categoryId: string): Promise<Campaign[]> {
  const { data } = await supabase.from('campaigns').select('*').eq('category_id', categoryId).order('seq').order('created_at')
  return (data ?? []) as Campaign[]
}

export async function createCampaign(patch: Partial<Campaign>) {
  return supabase.from('campaigns').insert(patch).select().single()
}

export async function updateCampaign(id: string, patch: Partial<Campaign>) {
  return supabase.from('campaigns').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function deleteCampaign(id: string) {
  return supabase.from('campaigns').delete().eq('id', id)
}

/** Důvody, proč kampaň nelze publikovat (server, migrace 034). Prázdné = OK. */
export async function getCampaignPublishErrors(campaignId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('campaign_publish_errors', { p_campaign_id: campaignId })
  if (error) return []
  return (data ?? []) as string[]
}

/** Duplikuje kampaň jako koncept (včetně událostí). Vrátí ID nové kampaně. */
export async function duplicateCampaign(campaignId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('admin_duplicate_campaign', { p_campaign_id: campaignId })
  if (error) throw error
  return (data as string) ?? null
}

/** Události kampaně (position 1..N). */
export async function getCampaignEvents(campaignId: string): Promise<CampaignEvent[]> {
  const { data } = await supabase.from('campaign_events').select('*').eq('campaign_id', campaignId).order('position')
  return (data ?? []) as CampaignEvent[]
}

/** Přepíše celou 5-tici událostí kampaně (smaže + vloží). eventIds = pole v pořadí (max 5). */
export async function setCampaignEvents(campaignId: string, eventIds: string[]): Promise<{ error: Error | null }> {
  const { error: delErr } = await supabase.from('campaign_events').delete().eq('campaign_id', campaignId)
  if (delErr) return { error: delErr as Error }
  const rows = eventIds.slice(0, 5).map((event_id, i) => ({ campaign_id: campaignId, position: i + 1, event_id }))
  if (rows.length === 0) return { error: null }
  const { error } = await supabase.from('campaign_events').insert(rows)
  return { error: error as Error | null }
}

// ─── Entitlementy (Free / Premium) ────────────────────────

/** Načte práva přihlášeného uživatele. Server respektuje expiraci (migrace 030). */
export async function getMyEntitlements(): Promise<Entitlements> {
  const { data, error } = await supabase.rpc('get_my_entitlements')
  if (error) return FREE_ENTITLEMENTS
  const row = Array.isArray(data) ? data[0] : data
  return {
    isPremium: !!row?.is_premium,
    premiumUntil: (row?.premium_until as string | null) ?? null,
  }
}

/** Admin: nastaví/odebere Premium (s auditem). `until = null` → trvalé. */
export async function adminSetPremium(userId: string, isPremium: boolean, until: string | null, reason?: string) {
  return supabase.rpc('admin_set_premium', {
    p_user: userId, p_is_premium: isPremium, p_until: until, p_reason: reason ?? null,
  })
}

// ─── Kampaně (hráč) ───────────────────────────────────────

export interface Expeditions {
  /** -1 = neomezeně (Premium nebo vypnutý limit) */
  remaining: number
  perDay: number
  used: number
  bonus: number
  isPremium: boolean
  /** ISO čas obnovení (nejbližší půlnoc UTC) */
  resetsAt: string | null
}

export const FREE_EXPEDITIONS: Expeditions = {
  remaining: DAILY_EXPEDITIONS, perDay: DAILY_EXPEDITIONS, used: 0, bonus: 0,
  isPremium: false, resetsAt: null,
}

/** Zbývající výpravy — autoritativně ze serveru (migrace 032). */
export async function getMyExpeditions(): Promise<Expeditions> {
  const { data, error } = await supabase.rpc('get_my_expeditions')
  if (error) return FREE_EXPEDITIONS
  const row = Array.isArray(data) ? data[0] : data
  return {
    remaining: row?.remaining ?? 0,
    perDay: row?.per_day ?? DAILY_EXPEDITIONS,
    used: row?.used ?? 0,
    bonus: row?.bonus ?? 0,
    isPremium: !!row?.is_premium,
    resetsAt: (row?.resets_at as string | null) ?? null,
  }
}

/** Admin: přidá hráči bonusové výpravy na dnešek (nebo zadané datum). */
export async function adminGrantExpeditions(userId: string, count: number, date?: string) {
  return supabase.rpc('admin_grant_expeditions', { p_user: userId, p_count: count, p_date: date ?? null })
}

export interface CampaignBundle {
  categories: CampaignCategory[]
  campaignsByCat: Record<string, Campaign[]>
  progress: Record<string, UserCampaignProgress>  // klíč = campaign_id
  totalStars: number
  expeditions: Expeditions
  isPremium: boolean
  entitlements: Entitlements
}

/** Načte vše pro hráčskou obrazovku kampaní (jen publikované + vlastní progress + výpravy). */
export async function getCampaignBundle(userId: string): Promise<CampaignBundle> {
  const [catsRes, campsRes, progRes, exp, ent] = await Promise.all([
    supabase.from('campaign_categories').select('*').eq('status', 'published').order('seq'),
    supabase.from('campaigns').select('*').eq('status', 'published').order('seq'),
    supabase.from('user_campaign_progress').select('*').eq('user_id', userId),
    getMyExpeditions(),
    getMyEntitlements(),
  ])
  const allCats = (catsRes.data ?? []) as CampaignCategory[]
  const campaigns = (campsRes.data ?? []) as Campaign[]
  const campaignsByCat: Record<string, Campaign[]> = {}
  for (const c of campaigns) (campaignsByCat[c.category_id] ??= []).push(c)
  // Kategorie bez publikovaného obsahu se hráči vůbec nezobrazují (zadání: „Skrytá")
  const categories = allCats.filter(c => isCategoryVisible(c, campaignsByCat[c.id] ?? []))

  const progress: Record<string, UserCampaignProgress> = {}
  for (const p of (progRes.data ?? []) as UserCampaignProgress[]) progress[p.campaign_id] = p
  return {
    categories, campaignsByCat, progress,
    totalStars: globalStars(progress),
    expeditions: exp,
    // Premium z entitlementů (respektuje expiraci)
    isPremium: isPremiumUser(ent),
    entitlements: ent,
  }
}

/** Načte plné události v zadaném pořadí (pro campaign runner). */
export async function getEventsByIds(ids: string[]): Promise<Event[]> {
  if (!ids.length) return []
  const { data } = await supabase.from('events').select('*').in('id', ids)
  const byId = new Map((data ?? []).map(e => [(e as Event).id, e as Event]))
  return ids.map(id => byId.get(id)).filter(Boolean) as Event[]
}

/** Chyby, které vrací serverové RPC kampaní (rozlišujeme je v UI). */
export type CampaignError =
  | 'no_energy' | 'premium_required' | 'locked_global_stars' | 'locked_category_stars'
  | 'campaign_not_available' | 'campaign_incomplete' | 'rounds_incomplete' | 'unknown'

export function campaignErrorOf(e: unknown): CampaignError {
  const msg = (e as { message?: string })?.message ?? ''
  for (const k of ['no_energy', 'premium_required', 'locked_global_stars', 'locked_category_stars',
    'campaign_not_available', 'campaign_incomplete', 'rounds_incomplete'] as const) {
    if (msg.includes(k)) return k
  }
  return 'unknown'
}

export interface CampaignAttemptStart {
  attemptId: string
  roundsTotal: number
  eventIds: string[]
  /** -1 = premium (neomezeně) */
  energyLeft: number
  /** true = navázali jsme na rozehraný pokus (výprava se NEodečetla znovu) */
  resumed: boolean
}

/**
 * Spustí (nebo obnoví) pokus o kampaň. Server ověří hvězdy, Premium i denní limit
 * a teprve pak odečte výpravu. Rozehraný pokus vrátí bez další útraty.
 */
export async function startCampaignAttempt(campaignId: string): Promise<CampaignAttemptStart> {
  const { data, error } = await supabase.rpc('start_campaign_attempt', { p_campaign_id: campaignId })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return {
    attemptId: row?.attempt_id as string,
    roundsTotal: row?.rounds_total ?? 0,
    eventIds: (row?.event_ids ?? []) as string[],
    energyLeft: row?.energy_left ?? 0,
    resumed: !!row?.resumed,
  }
}

/**
 * Odešle JEDNO kolo — klient posílá pouze tip, skóre počítá server.
 * Idempotentní: opakované odeslání vrátí původní výsledek, nepřepíše ho.
 */
export async function submitCampaignRound(
  attemptId: string, position: number,
  guessLat: number | null, guessLng: number | null, guessYear: number,
): Promise<{ locationScore: number; yearScore: number; roundScore: number; distanceKm: number; yearDiff: number }> {
  const { data, error } = await supabase.rpc('submit_campaign_round', {
    p_attempt_id: attemptId, p_position: position,
    p_guess_lat: guessLat, p_guess_lng: guessLng, p_guess_year: guessYear,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return {
    locationScore: row?.location_score ?? 0,
    yearScore: row?.year_score ?? 0,
    roundScore: row?.round_score ?? 0,
    distanceKm: row?.distance_km ?? 0,
    yearDiff: row?.year_diff ?? 0,
  }
}

/** Dokončí pokus — server sečte kola, spočítá ★, uloží rekord a udělí odměny. Idempotentní. */
export async function completeCampaignAttempt(attemptId: string): Promise<{
  totalScore: number; stars: number; bestScore: number; bestStars: number
  isBest: boolean; newRewards: CampaignReward[]
}> {
  const { data, error } = await supabase.rpc('complete_campaign_attempt', { p_attempt_id: attemptId })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return {
    totalScore: row?.total_score ?? 0,
    stars: row?.stars ?? 0,
    bestScore: row?.best_score ?? 0,
    bestStars: row?.best_stars ?? 0,
    isBest: !!row?.is_best,
    newRewards: (row?.new_rewards ?? []) as CampaignReward[],
  }
}

// ─── Odměny (artefakty) ───────────────────────────────────

/** Odměny přihlášeného hráče (sbírka). */
export async function getMyRewards(): Promise<EarnedReward[]> {
  const { data, error } = await supabase.rpc('get_my_rewards')
  if (error) return []
  return (data ?? []) as EarnedReward[]
}

/** Odměny definované pro kampaň (admin i hráč — detail kampaně). */
export async function getCampaignRewards(campaignId: string): Promise<CampaignReward[]> {
  const { data } = await supabase
    .from('campaign_rewards').select('*')
    .eq('campaign_id', campaignId).order('required_stars')
  return (data ?? []) as CampaignReward[]
}

export async function upsertCampaignReward(reward: Partial<CampaignReward>) {
  return supabase.from('campaign_rewards').upsert(reward, { onConflict: 'campaign_id,required_stars' })
}

export async function deleteCampaignReward(id: string) {
  return supabase.from('campaign_rewards').delete().eq('id', id)
}


// ─── Kontinent (odvození z GPS) ───────────────────────────

export interface ContinentBatchResult {
  total: number
  updated: number
  confident: number
  uncertain: { id: string; title: string; lat: number; lng: number; guess: string | null }[]
}

/**
 * Dávkově dopočítá kontinent všem událostem z jejich GPS (offline).
 * Ruční hodnoty (continent_source='manual') NEPŘEPISUJE.
 * Nejisté případy (hranice, oceán) nechá null a vrátí je k ruční kontrole.
 */
export async function recomputeContinents(): Promise<ContinentBatchResult> {
  const { continentOf } = await import('./continent')
  const { data } = await supabase
    .from('events')
    .select('id, title, lat, lng, continent, continent_source')
  const rows = (data ?? []) as { id: string; title: string; lat: number; lng: number; continent: string | null; continent_source: string }[]

  const res: ContinentBatchResult = { total: rows.length, updated: 0, confident: 0, uncertain: [] }
  const nowIso = new Date().toISOString()

  for (const r of rows) {
    if (r.continent_source === 'manual') continue  // ruční nepřepisuj
    const { continent, confident } = continentOf(r.lat, r.lng)
    if (confident && continent) {
      if (r.continent !== continent) {
        await supabase.from('events').update({
          continent, continent_source: 'auto', continent_computed_at: nowIso,
        }).eq('id', r.id)
        res.updated++
      }
      res.confident++
    } else {
      // nech null (nezobrazuj nespolehlivý údaj) + nabídni k ruční kontrole
      if (r.continent !== null) {
        await supabase.from('events').update({ continent: null, continent_computed_at: nowIso }).eq('id', r.id)
      }
      res.uncertain.push({ id: r.id, title: r.title, lat: r.lat, lng: r.lng, guess: continent })
    }
  }
  return res
}

/** Admin: ruční nastavení kontinentu (má přednost před auto-výpočtem). */
export async function setEventContinent(eventId: string, continent: string | null) {
  return supabase.from('events').update({
    continent,
    continent_source: continent ? 'manual' : 'auto',
    continent_computed_at: new Date().toISOString(),
  }).eq('id', eventId)
}

// ─── Single Player scénáře ────────────────────────────────

/** Vlastní scénáře (RLS pustí jen moje). */
export async function getMyPresets(): Promise<SinglePlayerPreset[]> {
  const { data } = await supabase
    .from('single_player_presets').select('*').order('updated_at', { ascending: false })
  return (data ?? []).map(p => ({ ...(p as SinglePlayerPreset), rules: normalizeRules((p as { rules: unknown }).rules) }))
}

export async function createPreset(userId: string, name: string, rules: PresetRules) {
  return supabase.from('single_player_presets')
    .insert({ user_id: userId, name, rules }).select().single()
}

export async function updatePreset(id: string, patch: { name?: string; rules?: PresetRules }) {
  return supabase.from('single_player_presets')
    .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function deletePreset(id: string) {
  return supabase.from('single_player_presets').delete().eq('id', id)
}

/** Zapne/vypne sdílení; vrátí slug (nebo null při vypnutí). */
export async function setPresetShared(presetId: string, shared: boolean): Promise<string | null> {
  const { data, error } = await supabase.rpc('set_preset_shared', { p_preset_id: presetId, p_shared: shared })
  if (error) throw error
  return (data as string) ?? null
}

/** Sdílený scénář podle slugu (jde jen adresně, ne výpisem). */
export async function getSharedPreset(slug: string): Promise<SharedPreset | null> {
  const { data, error } = await supabase.rpc('get_shared_preset', { p_slug: slug })
  if (error) return null
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return { id: row.id, name: row.name, rules: normalizeRules(row.rules), owner_name: row.owner_name ?? null }
}

/** Premium filtr: události, které jsem dříve určil špatně. */
export async function getMyMistakeEventIds(maxScore = 500): Promise<string[]> {
  const { data, error } = await supabase.rpc('my_mistake_event_ids', { p_max_score: maxScore })
  if (error) return []
  return (data ?? []) as string[]
}

/** Premium filtr: události, které jsem už v dohraných hrách viděl. */
export async function getMyPlayedEventIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('my_played_event_ids')
  if (error) return []
  return (data ?? []) as string[]
}

/**
 * Úklid multiplayeru z klienta (throttlovaně) — protože pg_cron nemusí být
 * zapnutý. Zavře neaktivní čekárny a smaže staré místnosti. Volá se při otevření
 * MP lobby, ale nejvýš jednou za 10 minut na tomhle zařízení.
 */
export async function maintainMultiplayer(): Promise<void> {
  try {
    const KEY = 'hg_mp_maintain_at'
    const last = Number(localStorage.getItem(KEY) || 0)
    if (Date.now() - last < 10 * 60_000) return
    localStorage.setItem(KEY, String(Date.now()))
    await supabase.rpc('maintain_multiplayer')
  } catch { /* úklid je best-effort */ }
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
