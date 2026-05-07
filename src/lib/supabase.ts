import { createClient } from '@supabase/supabase-js'
import type { Event, EventInsert, EventUpdate, RoundResult } from '@/types/database'

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

export async function getRandomEvents(count = 5): Promise<Event[]> {
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('published', true)
    .limit(count * 4)
  if (!data) return []
  return shuffleArray(data).slice(0, count) as Event[]
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

// ─── Utils ────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
