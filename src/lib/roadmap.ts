import { supabase } from './supabase'

export type RoadmapStatus = 'idea' | 'planned' | 'in_progress' | 'done'

export interface RoadmapItem {
  id: string
  title: string
  description: string | null
  status: RoadmapStatus
  sort: number
  votes: number
  voted: boolean
  mine: boolean
}

/** Seznam položek roadmapy s počty hlasů a příznakem, zda uživatel hlasoval. */
export async function getRoadmap(): Promise<RoadmapItem[]> {
  const { data, error } = await supabase.rpc('roadmap_list')
  if (error || !Array.isArray(data)) return []
  return data.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    status: r.status as RoadmapStatus,
    sort: (r.sort as number) ?? 0,
    votes: Number(r.votes ?? 0),
    voted: !!r.voted,
    mine: !!r.mine,
  }))
}

/** Přepne hlas (jen Premium). Vrací nový stav (true = hlasováno). */
export async function toggleRoadmapVote(itemId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('roadmap_toggle_vote', { p_item: itemId })
  if (error) throw error
  return !!data
}

/** Navrhne nápad (jen Premium). Vrací id nové položky. */
export async function suggestRoadmapItem(title: string, description: string): Promise<string> {
  const { data, error } = await supabase.rpc('roadmap_suggest', { p_title: title, p_description: description })
  if (error) throw error
  return data as string
}

// ─── Admin ────────────────────────────────────────────────

export async function adminListRoadmap(): Promise<RoadmapItem[]> {
  // Admin čte přímo tabulku (RLS: admin = all) a dopočte hlasy zvlášť.
  const { data } = await supabase.from('roadmap_items').select('*').order('sort', { ascending: true }).order('created_at', { ascending: false })
  const items = (data ?? []) as Array<{ id: string; title: string; description: string | null; status: RoadmapStatus; sort: number }>
  const { data: votes } = await supabase.from('roadmap_votes').select('item_id')
  const counts = new Map<string, number>()
  for (const v of (votes ?? []) as { item_id: string }[]) counts.set(v.item_id, (counts.get(v.item_id) ?? 0) + 1)
  return items.map(i => ({ ...i, votes: counts.get(i.id) ?? 0, voted: false, mine: false }))
}

export async function adminCreateRoadmap(title: string, description: string, status: RoadmapStatus) {
  return supabase.from('roadmap_items').insert({ title, description: description || null, status })
}

export async function adminUpdateRoadmap(id: string, patch: Partial<{ title: string; description: string | null; status: RoadmapStatus; sort: number }>) {
  return supabase.from('roadmap_items').update(patch).eq('id', id)
}

export async function adminDeleteRoadmap(id: string) {
  return supabase.from('roadmap_items').delete().eq('id', id)
}
