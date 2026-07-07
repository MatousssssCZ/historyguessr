// Čisté funkce pro odemykání a hvězdy kampaní (sdílené klient + shodné s RPC).
import type { CampaignCategory, Campaign, UserCampaignProgress } from '@/types/database'

export const DAILY_ENERGY = 5

// Thresholdy ★ z max 5000 b. za kampaň (musí sedět s migrací 028 RPC).
export const STAR_THRESHOLDS = [2000, 3250, 4250] as const

export function starsForScore(score: number): number {
  if (score >= STAR_THRESHOLDS[2]) return 3
  if (score >= STAR_THRESHOLDS[1]) return 2
  if (score >= STAR_THRESHOLDS[0]) return 1
  return 0
}

/** Aktuální energie s ohledem na líný denní reset (UTC půlnoc). Premium = ∞ (vrací Infinity). */
export function effectiveEnergy(energy: number, resetAt: string | null, isPremium: boolean): number {
  if (isPremium) return Infinity
  const todayUtc = new Date().toISOString().slice(0, 10)
  if (!resetAt || resetAt < todayUtc) return DAILY_ENERGY
  return energy
}

/** Kategorie odemčená = dost globálních ★ (a případně premium, je-li placená). */
export function isCategoryUnlocked(cat: CampaignCategory, totalStars: number, isPremium: boolean): boolean {
  if (cat.is_premium && !isPremium) return false
  return totalStars >= cat.unlock_stars
}

/** Kampaň v kategorii se odemyká sekvenčně: první vždy, další po dokončení předchozí na ≥1★. */
export function isCampaignUnlocked(campaigns: Campaign[], index: number, progress: Record<string, UserCampaignProgress>): boolean {
  if (index <= 0) return true
  const prev = campaigns[index - 1]
  const p = progress[prev.id]
  return !!p && p.stars >= 1
}

/** Součet získaných ★ v jedné kategorii (pro zobrazení postupu). */
export function categoryStars(campaigns: Campaign[], progress: Record<string, UserCampaignProgress>): { earned: number; max: number } {
  let earned = 0
  for (const c of campaigns) earned += progress[c.id]?.stars ?? 0
  return { earned, max: campaigns.length * 3 }
}
