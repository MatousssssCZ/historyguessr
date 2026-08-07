import { supabase } from './supabase'

export type FeedbackKind = 'bug' | 'idea' | 'other'
export type FeedbackStatus = 'new' | 'in_progress' | 'done'

export interface FeedbackRow {
  id: string
  kind: FeedbackKind
  message: string
  page: string | null
  user_agent: string | null
  user_id: string | null
  status: FeedbackStatus
  created_at: string
}

/** Odešle zpětnou vazbu / hlášení chyby (funguje i pro anonymní uživatele).
 *  page + user-agent se doplní automaticky. */
export async function submitFeedback(kind: FeedbackKind, message: string, page?: string): Promise<void> {
  const p = page ?? (typeof location !== 'undefined' ? location.pathname : null)
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : null
  const { error } = await supabase.rpc('submit_feedback', { p_kind: kind, p_message: message, p_page: p, p_ua: ua })
  if (error) throw error
}

// ─── Admin ────────────────────────────────────────────────

export async function adminListFeedback(): Promise<FeedbackRow[]> {
  const { data } = await supabase.from('feedback').select('*').order('created_at', { ascending: false })
  return (data ?? []) as FeedbackRow[]
}

export async function adminSetFeedbackStatus(id: string, status: FeedbackStatus) {
  return supabase.from('feedback').update({ status }).eq('id', id)
}
