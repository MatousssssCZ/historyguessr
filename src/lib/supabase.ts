import { createClient } from '@supabase/supabase-js'
import type { Database, Event, RoundResult } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Chybí VITE_SUPABASE_URL nebo VITE_SUPABASE_ANON_KEY v .env.local')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

// ─── Auth helpers ─────────────────────────────────────────

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  return { data, error }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// ─── Profile helpers ──────────────────────────────────────

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return { data, error }
}

export async function updateProfile(userId: string, updates: { username?: string; avatar_url?: string }) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  return { data, error }
}

// ─── Events helpers ───────────────────────────────────────

/** Načte N náhodných publishovaných událostí pro hru */
export async function getRandomEvents(count = 5): Promise<Event[]> {
  // Supabase nemá přímý random(), použijeme client-side shuffle
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('published', true)
    .limit(count * 4) // načteme víc a pak zamícháme
  if (error || !data) return []
  return shuffleArray(data).slice(0, count)
}

/** Načte všechny události pro admin (včetně nepublishovaných) */
export async function getAdminEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
  return { data, error }
}

export async function createEvent(event: Database['public']['Tables']['events']['Insert']) {
  const { data, error } = await supabase
    .from('events')
    .insert(event)
    .select()
    .single()
  return { data, error }
}

export async function updateEvent(id: string, updates: Database['public']['Tables']['events']['Update']) {
  const { data, error } = await supabase
    .from('events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from('events').delete().eq('id', id)
  return { error }
}

export async function togglePublished(id: string, published: boolean) {
  return updateEvent(id, { published })
}

// ─── Game session helpers ─────────────────────────────────

export async function createGameSession(userId: string) {
  const { data, error } = await supabase
    .from('game_sessions')
    .insert({ user_id: userId, rounds: [] })
    .select()
    .single()
  return { data, error }
}

export async function finishGameSession(
  sessionId: string,
  rounds: RoundResult[],
  totalScore: number,
) {
  const { data, error } = await supabase
    .from('game_sessions')
    .update({
      finished_at: new Date().toISOString(),
      rounds: rounds as unknown as Database['public']['Tables']['game_sessions']['Update']['rounds'],
      total_score: totalScore,
    })
    .eq('id', sessionId)
    .select()
    .single()
  return { data, error }
}

/** Po skončení hry přičte skóre k profilu */
export async function addScoreToProfile(userId: string, score: number) {
  // Použijeme RPC (stored procedure) pro atomický update
  const { error } = await supabase.rpc('increment_user_score', {
    p_user_id: userId,
    p_score: score,
  })
  return { error }
}

// ─── Storage helpers ──────────────────────────────────────

const PANORAMA_BUCKET = 'panorama'
const EVENTS_BUCKET = 'events'

export async function uploadPanorama(file: File, eventId: string) {
  const ext = file.name.split('.').pop()
  const path = `${eventId}/panorama.${ext}`
  const { data, error } = await supabase.storage
    .from(PANORAMA_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) return { url: null, error }
  const { data: urlData } = supabase.storage.from(PANORAMA_BUCKET).getPublicUrl(path)
  return { url: urlData.publicUrl, error: null }
}

export async function uploadEventImage(file: File, eventId: string) {
  const ext = file.name.split('.').pop()
  const path = `${eventId}/cover.${ext}`
  const { data, error } = await supabase.storage
    .from(EVENTS_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) return { url: null, error }
  const { data: urlData } = supabase.storage.from(EVENTS_BUCKET).getPublicUrl(path)
  return { url: urlData.publicUrl, error: null }
}

export async function deleteEventFiles(eventId: string) {
  await supabase.storage.from(PANORAMA_BUCKET).remove([`${eventId}/panorama.jpg`, `${eventId}/panorama.png`])
  await supabase.storage.from(EVENTS_BUCKET).remove([`${eventId}/cover.jpg`, `${eventId}/cover.png`])
}

// ─── Utils ────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
