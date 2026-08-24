import { supabase } from '@/lib/supabase'
import type { Event } from '@/types/database'

export type TaskStatus = 'todo' | 'in_progress' | 'submitted' | 'approved' | 'rejected'

export interface EventTask {
  id: string
  title: string
  year: number | null
  category: string | null
  note: string | null
  status: TaskStatus
  assigned_to: string | null
  event_id: string | null
  review_note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// ── Číselník (editor i admin, RLS řídí viditelnost) ─────────────────────────
export async function listTasks(statuses?: TaskStatus[]): Promise<EventTask[]> {
  let q = supabase.from('event_tasks').select('*').order('updated_at', { ascending: false })
  if (statuses && statuses.length) q = q.in('status', statuses)
  const { data } = await q
  return (data ?? []) as EventTask[]
}

export async function getTask(id: string): Promise<EventTask | null> {
  const { data } = await supabase.from('event_tasks').select('*').eq('id', id).single()
  return (data as EventTask) ?? null
}

// ── Admin: zadávání ─────────────────────────────────────────────────────────
export async function createTask(input: { title: string; year?: number | null; category?: string | null; note?: string | null }) {
  const { data } = await supabase.auth.getUser()
  return supabase.from('event_tasks').insert({
    title: input.title.trim(),
    year: input.year ?? null,
    category: input.category ?? null,
    note: input.note?.trim() || null,
    created_by: data.user?.id ?? null,
  }).select().single()
}

export async function deleteTask(id: string) {
  return supabase.from('event_tasks').delete().eq('id', id)
}

// ── Editor: zabrat / odeslat ────────────────────────────────────────────────
export async function claimTask(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('claim_event_task', { p_task: id })
  return { error: error ? (error.message || 'error') : null }
}

export async function attachTaskEvent(taskId: string, eventId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('attach_event_task', { p_task: taskId, p_event: eventId })
  return { error: error ? (error.message || 'error') : null }
}

export async function submitTask(taskId: string, eventId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('submit_event_task', { p_task: taskId, p_event: eventId })
  return { error: error ? (error.message || 'error') : null }
}

// ── Admin: schválení / zrušení / vrácení ────────────────────────────────────
export async function approveTask(taskId: string, eventId: string): Promise<{ error: string | null }> {
  const { error: e1 } = await supabase.from('events')
    .update({ published: true, status: 'published', updated_at: new Date().toISOString() })
    .eq('id', eventId)
  if (e1) return { error: e1.message }
  const { error: e2 } = await supabase.from('event_tasks').update({ status: 'approved' }).eq('id', taskId)
  return { error: e2 ? e2.message : null }
}

export async function rejectTask(taskId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('event_tasks').update({ status: 'rejected' }).eq('id', taskId)
  return { error: error ? error.message : null }
}

export async function returnTask(taskId: string, note: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('return_event_task', { p_task: taskId, p_note: note })
  return { error: error ? (error.message || 'error') : null }
}

// ── Načtení draftu události k zadání (pro prefill formuláře) ─────────────────
export async function getEventById(id: string): Promise<Event | null> {
  const { data } = await supabase.from('events').select('*').eq('id', id).single()
  return (data as Event) ?? null
}

// ── Admin: přiřazení role ───────────────────────────────────────────────────
export async function setUserRole(username: string, role: 'user' | 'editor' | 'admin'): Promise<string> {
  const { data, error } = await supabase.rpc('set_user_role', { p_username: username, p_role: role })
  if (error) return 'error'
  return (data as string) ?? 'error'
}
