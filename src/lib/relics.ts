// Kronika & relikvie — datová vrstva. Jedna relikvie na kampaň, 4 úrovně
// vzácnosti (common→rare→epic→legendary) jako GLB modely. Čtení je defenzivní.
import { supabase } from './supabase'
import i18n from '@/i18n'

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export type RelicState = Rarity  // (zachován název kvůli importům)

export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary']
export const RARITY_RANK: Record<Rarity, number> = { common: 1, rare: 2, epic: 3, legendary: 4 }
export const RARITY_META: Record<Rarity, { tone: string; key: string }> = {
  common:    { tone: '#8A7E6C', key: 'common' },
  rare:      { tone: '#4E6E88', key: 'rare' },
  epic:      { tone: '#7E4E7A', key: 'epic' },
  legendary: { tone: '#B08040', key: 'legendary' },
}

export interface Relic {
  id: string
  slug: string
  campaign_id: string | null
  set_id: string | null
  name: string
  name_en: string | null
  name_de: string | null
  year_label: string | null
  category: string | null
  secret: boolean
  description: string | null
  description_en: string | null
  description_de: string | null
  icon_url: string | null
  silhouette_url: string | null
  model_common: string | null
  model_rare: string | null
  model_epic: string | null
  model_legendary: string | null
  seq: number
}

export interface PlayerRelic {
  relic_id: string
  state: Rarity
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

export type RelicTileState = Rarity | 'locked' | 'secret'

export interface RelicView {
  relic: Relic
  state: RelicTileState
  owned: PlayerRelic | null
  ownedPct: number
  bestScore: number
  bestStars: number
  maxScore: number
}

export interface KronikaBundle {
  relics: RelicView[]
  sets: { set: RelicSet; relics: RelicView[] }[]
  showcase: RelicView[]
  byCategory: Record<string, { owned: number; total: number }>
  ownedTotal: number
  total: number
}

export interface RevealedRelic {
  relic: Relic
  state: Rarity
  stars: number
  score: number
  maxScore: number
}

/** Lokalizovaný název relikvie (fallback na český). */
export function relicName(r: Pick<Relic, 'name' | 'name_en' | 'name_de'>): string {
  const lng = (i18n.language || 'cs').slice(0, 2)
  if (lng === 'en') return r.name_en?.trim() || r.name
  if (lng === 'de') return r.name_de?.trim() || r.name
  return r.name
}

/** Lokalizovaný popis relikvie (fallback na český). */
export function relicDesc(r: Pick<Relic, 'description' | 'description_en' | 'description_de'>): string | null {
  const lng = (i18n.language || 'cs').slice(0, 2)
  if (lng === 'en') return r.description_en?.trim() || r.description
  if (lng === 'de') return r.description_de?.trim() || r.description
  return r.description
}

/** Vzácnost dle nejlepšího výkonu (legendary=plný počet bodů, epic=3★, rare=2★, common=dokončeno). */
export function rarityFor(stars: number, score: number, maxScore: number): Rarity {
  if (maxScore > 0 && score >= maxScore) return 'legendary'
  if (stars >= 3) return 'epic'
  if (stars >= 2) return 'rare'
  return 'common'
}

function tileState(r: Relic, pr: PlayerRelic | null): RelicTileState {
  if (pr) return pr.state
  return r.secret ? 'secret' : 'locked'
}

/** GLB model pro danou vzácnost; fallback na nejbližší nižší dostupný, jinak null → UI zobrazí ikonu. */
export function relicModel(r: Relic, rarity: Rarity): string | null {
  const order: Rarity[] = ['legendary', 'epic', 'rare', 'common']
  const start = order.indexOf(rarity)
  for (let i = start < 0 ? 0 : start; i < order.length; i++) {
    const url = r[`model_${order[i]}` as `model_${Rarity}`]
    if (url) return url
  }
  // zkus i vyšší, kdyby nižší chyběly
  for (const k of order) { const u = r[`model_${k}` as `model_${Rarity}`]; if (u) return u }
  return null
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

    const setViews = sets.map(set => ({ set, relics: views.filter(v => v.relic.set_id === set.id) }))

    return {
      relics: views,
      sets: setViews,
      showcase: views.filter(v => v.owned?.showcased),
      byCategory,
      ownedTotal: views.filter(v => v.owned).length,
      total: views.length,
    }
  } catch (e) {
    console.warn('[relics] getKronikaBundle selhalo (běží migrace relikvií?):', e)
    return EMPTY
  }
}

/** Po dokončení kampaně vrať relikvii k odhalení (32c) s vypočtenou vzácností. */
export async function getRevealForCampaign(campaignId: string, stars: number, score: number, maxScore: number): Promise<RevealedRelic | null> {
  try {
    const { data } = await supabase.from('relics').select('*').eq('campaign_id', campaignId).maybeSingle()
    if (!data) return null
    return { relic: data as Relic, state: rarityFor(stars, score, maxScore), stars, score, maxScore }
  } catch {
    return null
  }
}

/**
 * Vrátí relikvii k odhalení, jen když je pro hráče NOVÁ (dosud ji neměl).
 * Grant běží server-side triggerem při dokončení, takže tu už relikvie existuje;
 * novost poznáme podle čerstvého `acquired_at` (starší = měl ji už dřív → neodhalujeme).
 * Vrací skutečně udělenou vzácnost z DB (ne přepočet), aby seděla s Kronikou.
 */
export async function getNewRelicReveal(
  campaignId: string, userId: string, stars: number, score: number, maxScore: number, freshWithinMs = 180000,
): Promise<RevealedRelic | null> {
  try {
    const { data: relic } = await supabase.from('relics').select('*').eq('campaign_id', campaignId).maybeSingle()
    if (!relic) return null
    const { data: pr } = await supabase
      .from('player_relics').select('state, acquired_at')
      .eq('user_id', userId).eq('relic_id', (relic as Relic).id).maybeSingle()
    if (!pr) return null  // grant ještě nedoběhl nebo relikvie neudělena
    const acquired = new Date((pr as { acquired_at: string }).acquired_at).getTime()
    if (Number.isFinite(acquired) && Date.now() - acquired > freshWithinMs) return null  // měl ji už dřív
    return { relic: relic as Relic, state: (pr as { state: Rarity }).state, stars, score, maxScore }
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

export async function getRelicSets(): Promise<RelicSet[]> {
  const { data } = await supabase.from('relic_sets').select('*').order('seq')
  return (data ?? []) as RelicSet[]
}

/** Nahraje 2D ikonu relikvie (WebP) do bucketu `relics`. */
export async function uploadRelicIcon(file: File, slug: string): Promise<{ url: string | null; error: string | null }> {
  const path = `${slug}/icon.webp`
  const { error } = await supabase.storage.from('relics').upload(path, file, { upsert: true, contentType: 'image/webp' })
  if (error) return { url: null, error: error.message }
  const { data } = supabase.storage.from('relics').getPublicUrl(path)
  return { url: `${data.publicUrl}?t=${Date.now()}`, error: null }
}

/** Nahraje siluetu relikvie (PNG s průhledností) do bucketu `relics` — pro ražený odznak. */
export async function uploadRelicSilhouette(file: File, slug: string): Promise<{ url: string | null; error: string | null }> {
  const path = `${slug}/silhouette.png`
  const { error } = await supabase.storage.from('relics').upload(path, file, { upsert: true, contentType: 'image/png' })
  if (error) return { url: null, error: error.message }
  const { data } = supabase.storage.from('relics').getPublicUrl(path)
  return { url: `${data.publicUrl}?t=${Date.now()}`, error: null }
}

/** Vystavené relikvie pro víc hráčů najednou (žebříček). Klíč = user_id. */
export async function getShowcaseForUsers(userIds: string[]): Promise<Record<string, PublicRelic[]>> {
  const out: Record<string, PublicRelic[]> = {}
  if (!userIds.length) return out
  try {
    const { data } = await supabase
      .from('player_relics')
      .select('user_id, state, relics(*)')
      .in('user_id', userIds).eq('showcased', true)
    const rows = (data ?? []) as unknown as { user_id: string; state: Rarity; relics: Relic | Relic[] | null }[]
    for (const r of rows) {
      const relic = Array.isArray(r.relics) ? r.relics[0] : r.relics
      if (!relic) continue
      ;(out[r.user_id] ??= []).push({ relic, state: r.state, ownedPct: 0 })
    }
  } catch { /* ignore */ }
  return out
}

/** Nahraje GLB model dané vzácnosti do bucketu `relics`. Vrátí veřejnou URL (cache-buster). */
export async function uploadRelicModel(file: File, slug: string, rarity: Rarity): Promise<{ url: string | null; error: string | null }> {
  const path = `${slug}/${rarity}.glb`
  const { error } = await supabase.storage.from('relics').upload(path, file, { upsert: true, contentType: 'model/gltf-binary' })
  if (error) return { url: null, error: error.message }
  const { data } = supabase.storage.from('relics').getPublicUrl(path)
  return { url: `${data.publicUrl}?t=${Date.now()}`, error: null }
}

/** Vystavené relikvie cizího hráče (read-only, pro profil). */
export interface PublicRelic { relic: Relic; state: Rarity; ownedPct: number }
export async function getPublicShowcase(userId: string): Promise<PublicRelic[]> {
  try {
    const { data } = await supabase
      .from('player_relics')
      .select('state, relics(*)')
      .eq('user_id', userId).eq('showcased', true)
    const rows = (data ?? []) as unknown as { state: Rarity; relics: Relic | Relic[] | null }[]
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
