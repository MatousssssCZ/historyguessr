// Kronika & relikvie — datová vrstva (handoff 32a–32e).
// Čtení je defenzivní: dokud neproběhne migrace 20260908120000, funkce vrátí
// prázdný balíček místo pádu (stejný vzor jako getCampaignBundle).
import { supabase } from './supabase'

export type RelicState = 'preserved' | 'perfect'

export interface Relic {
  id: string
  slug: string
  campaign_id: string | null
  set_id: string | null
  name: string
  year_label: string | null
  category: string | null
  secret: boolean
  description: string | null
  preserved_url: string | null
  perfect_url: string | null
  silhouette_url: string | null
  model_url: string | null
  seq: number
}

export interface PlayerRelic {
  relic_id: string
  state: RelicState
  acquired_at: string
  showcased: boolean
}

export interface RelicSet {
  id: string
  name: string
  reward_type: string
  reward_id: string | null
  reward_name: string | null
  seq: number
}

/** Odvozený stav dlaždice ve vitríně. */
export type RelicTileState = 'perfect' | 'preserved' | 'locked' | 'secret'

export interface RelicView {
  relic: Relic
  state: RelicTileState
  owned: PlayerRelic | null
  ownedPct: number           // podíl vlastníků (i u skryté)
  bestScore: number          // z campaign progress
  bestStars: number
  maxScore: number           // rounds_count × 1000
}

export interface KronikaBundle {
  relics: RelicView[]
  sets: { set: RelicSet; relics: RelicView[] }[]
  showcase: RelicView[]      // vystavené (max 3)
  byCategory: Record<string, { owned: number; total: number }>
  ownedTotal: number
  total: number
}

/** Newly-earned relikvie po dokončení kampaně (pro moment objevení 32c). */
export interface RevealedRelic {
  relic: Relic
  state: RelicState
  stars: number
  score: number
  maxScore: number
}

function tileState(r: Relic, pr: PlayerRelic | null): RelicTileState {
  if (pr) return pr.state === 'perfect' ? 'perfect' : 'preserved'
  if (r.secret) return 'secret'
  return 'locked'
}

/** Vhodný obrázek pro daný stav (fallback null → UI zobrazí ikonu). */
export function relicImage(r: Relic, state: RelicTileState): string | null {
  if (state === 'perfect') return r.perfect_url || r.preserved_url
  if (state === 'preserved') return r.preserved_url || r.perfect_url
  if (state === 'secret') return r.silhouette_url
  return r.silhouette_url  // locked → silueta, jinak ikona
}

const EMPTY: KronikaBundle = { relics: [], sets: [], showcase: [], byCategory: {}, ownedTotal: 0, total: 0 }

export async function getKronikaBundle(userId: string): Promise<KronikaBundle> {
  try {
    const [relicsRes, mineRes, ownRes, setsRes, progRes, campRes] = await Promise.all([
      supabase.from('relics').select('*').order('seq'),
      supabase.from('player_relics').select('relic_id, state, acquired_at, showcased').eq('user_id', userId),
      supabase.from('relic_ownership').select('relic_id, owned_pct'),
      supabase.from('relic_sets').select('*').order('seq'),
      supabase.from('user_campaign_progress').select('campaign_id, best_score, best_stars').eq('user_id', userId),
      supabase.from('campaigns').select('id, rounds_count'),
    ])
    if (relicsRes.error) throw relicsRes.error

    const relics = (relicsRes.data ?? []) as Relic[]
    const mine = new Map<string, PlayerRelic>()
    for (const p of (mineRes.data ?? []) as PlayerRelic[]) mine.set(p.relic_id, p)
    const pct = new Map<string, number>()
    for (const o of (ownRes.data ?? []) as { relic_id: string; owned_pct: number }[]) pct.set(o.relic_id, Number(o.owned_pct) || 0)
    const prog = new Map<string, { best_score: number; best_stars: number }>()
    for (const p of (progRes.data ?? []) as { campaign_id: string; best_score: number; best_stars: number }[]) prog.set(p.campaign_id, p)
    const rounds = new Map<string, number>()
    for (const c of (campRes.data ?? []) as { id: string; rounds_count: number }[]) rounds.set(c.id, c.rounds_count)
    const sets = (setsRes.data ?? []) as RelicSet[]

    const views: RelicView[] = relics.map(r => {
      const owned = mine.get(r.id) ?? null
      const p = r.campaign_id ? prog.get(r.campaign_id) : undefined
      const rc = r.campaign_id ? (rounds.get(r.campaign_id) ?? 5) : 5
      return {
        relic: r,
        state: tileState(r, owned),
        owned,
        ownedPct: pct.get(r.id) ?? 0,
        bestScore: p?.best_score ?? 0,
        bestStars: p?.best_stars ?? 0,
        maxScore: rc * 1000,
      }
    })

    const byCategory: Record<string, { owned: number; total: number }> = {}
    for (const v of views) {
      const cat = v.relic.category ?? 'other'
      const b = (byCategory[cat] ??= { owned: 0, total: 0 })
      b.total++
      if (v.owned) b.owned++
    }

    const setViews = sets.map(set => ({
      set,
      relics: views.filter(v => v.relic.set_id === set.id),
    }))

    return {
      relics: views,
      sets: setViews,
      showcase: views.filter(v => v.owned?.showcased),
      byCategory,
      ownedTotal: views.filter(v => v.owned).length,
      total: views.length,
    }
  } catch (e) {
    console.warn('[relics] getKronikaBundle selhalo (běží migrace 20260908120000?):', e)
    return EMPTY
  }
}

/** Po dokončení kampaně: pokud padly 3★, vrať relikvii k odhalení (32c). */
export async function getRevealForCampaign(campaignId: string, stars: number, score: number, maxScore: number): Promise<RevealedRelic | null> {
  if (stars < 3) return null
  try {
    const { data } = await supabase.from('relics').select('*').eq('campaign_id', campaignId).maybeSingle()
    if (!data) return null
    const relic = data as Relic
    return { relic, state: score >= maxScore ? 'perfect' : 'preserved', stars, score, maxScore }
  } catch {
    return null
  }
}

/** Přepne vystavení relikvie na profilu (server hlídá limit 3 triggerem). */
export async function setRelicShowcase(userId: string, relicId: string, showcased: boolean): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('player_relics')
    .update({ showcased }).eq('user_id', userId).eq('relic_id', relicId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ─── Admin ────────────────────────────────────────────────
export const RELIC_CATEGORIES = ['war', 'moments', 'places', 'inventions', 'art', 'sports', 'mysteries', 'disasters'] as const

export async function getRelicForCampaign(campaignId: string): Promise<Relic | null> {
  const { data } = await supabase.from('relics').select('*').eq('campaign_id', campaignId).maybeSingle()
  return (data as Relic) ?? null
}

export async function upsertRelicForCampaign(campaignId: string, patch: Partial<Relic>): Promise<{ data: Relic | null; error: string | null }> {
  const existing = await getRelicForCampaign(campaignId)
  if (existing) {
    const { data, error } = await supabase.from('relics').update(patch).eq('id', existing.id).select().maybeSingle()
    return { data: (data as Relic) ?? null, error: error?.message ?? null }
  }
  const { data, error } = await supabase.from('relics').insert({ ...patch, campaign_id: campaignId }).select().maybeSingle()
  return { data: (data as Relic) ?? null, error: error?.message ?? null }
}

/** Nahraje render relikvie do bucketu `relics` a vrátí veřejnou URL (s cache-busterem). */
export async function uploadRelicAsset(file: File, slug: string, kind: 'preserved' | 'perfect' | 'silhouette'): Promise<{ url: string | null; error: string | null }> {
  const path = `${slug}/${kind}.webp`
  const { error } = await supabase.storage.from('relics').upload(path, file, { upsert: true, contentType: 'image/webp' })
  if (error) return { url: null, error: error.message }
  const { data } = supabase.storage.from('relics').getPublicUrl(path)
  return { url: `${data.publicUrl}?t=${Date.now()}`, error: null }
}

export async function getRelicSets(): Promise<RelicSet[]> {
  const { data } = await supabase.from('relic_sets').select('*').order('seq')
  return (data ?? []) as RelicSet[]
}

/** Nahraje 3D model (GLB) relikvie do bucketu `relics`. GLB se nekomprimuje. */
export async function uploadRelicModel(file: File, slug: string): Promise<{ url: string | null; error: string | null }> {
  const path = `${slug}/model.glb`
  const { error } = await supabase.storage.from('relics').upload(path, file, { upsert: true, contentType: 'model/gltf-binary' })
  if (error) return { url: null, error: error.message }
  const { data } = supabase.storage.from('relics').getPublicUrl(path)
  return { url: `${data.publicUrl}?t=${Date.now()}`, error: null }
}

/** Vystavené relikvie cizího hráče (read-only, pro profil). */
export interface PublicRelic { relic: Relic; state: RelicState; ownedPct: number }
export async function getPublicShowcase(userId: string): Promise<PublicRelic[]> {
  try {
    const { data } = await supabase
      .from('player_relics')
      .select('state, relics(*)')
      .eq('user_id', userId).eq('showcased', true)
    const rows = (data ?? []) as unknown as { state: RelicState; relics: Relic | Relic[] | null }[]
    const relics = rows.map(r => (Array.isArray(r.relics) ? r.relics[0] : r.relics)).filter(Boolean) as Relic[]
    if (!relics.length) return []
    const { data: own } = await supabase.from('relic_ownership').select('relic_id, owned_pct').in('relic_id', relics.map(r => r.id))
    const pct = new Map((own ?? []).map((o: { relic_id: string; owned_pct: number }) => [o.relic_id, Number(o.owned_pct) || 0]))
    return rows.map(r => {
      const relic = Array.isArray(r.relics) ? r.relics[0] : r.relics
      return relic ? { relic, state: r.state, ownedPct: pct.get(relic.id) ?? 0 } : null
    }).filter(Boolean) as PublicRelic[]
  } catch {
    return []
  }
}
