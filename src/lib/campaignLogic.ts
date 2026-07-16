// Čistá logika kampaní — hvězdy, výpravy, odemykání.
//
// PRAVIDLO: prahy hvězd jsou definované RELATIVNĚ (podíl z maxima), takže fungují
// pro libovolný počet kol. Autoritativní hodnota žije na serveru v app_config
// (migrace 031); tyhle konstanty jsou jen zrcadlo pro UI a musí s ním sedět.
import type { CampaignCategory, Campaign, UserCampaignProgress } from '@/types/database'
import { type Entitlements, canAccessContent, type AccessResult } from './entitlements'

export const MAX_ROUND_SCORE = 1000
export const DEFAULT_ROUNDS = 5

/** Podíl z maxima pro 1★ / 2★ / 3★. Pro 5 kol → 2000 / 3250 / 4250 (dle zadání). */
export const STAR_THRESHOLD_PCT: readonly [number, number, number] = [0.40, 0.65, 0.85]

/** Absolutní prahy pro daný počet kol. Zaokrouhlení chrání před float chybou. */
export function starThresholds(
  roundsCount: number = DEFAULT_ROUNDS,
  pct: readonly [number, number, number] = STAR_THRESHOLD_PCT,
): [number, number, number] {
  const max = roundsCount * MAX_ROUND_SCORE
  return [Math.round(max * pct[0]), Math.round(max * pct[1]), Math.round(max * pct[2])]
}

export function maxScoreFor(roundsCount: number = DEFAULT_ROUNDS): number {
  return roundsCount * MAX_ROUND_SCORE
}

/** Skóre → hvězdy (0–3). Musí odpovídat public.campaign_stars_for_score. */
export function starsForScore(
  score: number,
  roundsCount: number = DEFAULT_ROUNDS,
  pct?: readonly [number, number, number] | null,
): number {
  const [t1, t2, t3] = starThresholds(roundsCount, pct ?? STAR_THRESHOLD_PCT)
  if (score >= t3) return 3
  if (score >= t2) return 2
  if (score >= t1) return 1
  return 0
}

// ─── Výpravy (denní limit) ────────────────────────────────

/**
 * Výchozí denní příděl. AUTORITA JE SERVER (app_config + RPC get_my_expeditions,
 * migrace 032) — tahle konstanta je jen fallback pro UI, než dorazí data.
 */
export const DAILY_EXPEDITIONS = 5

/** Formátuje zbývající výpravy: -1 ze serveru = neomezeně. */
export function formatExpeditions(remaining: number, perDay: number): string {
  return remaining < 0 ? '∞' : `${remaining}/${perDay}`
}

// ─── Odemykání ────────────────────────────────────────────

/** Kategorie: pevný globální práh ★ + případné Premium. */
export function categoryAccess(
  cat: CampaignCategory,
  totalStars: number,
  entitlements: Entitlements | null | undefined,
): AccessResult {
  return canAccessContent(
    { requiredStars: cat.required_global_stars, isPremium: cat.is_premium },
    { stars: totalStars, entitlements },
  )
}

/**
 * Kampaň: práh ★ V RÁMCI KATEGORIE. Záměrně NENÍ sekvenční („dokonči předchozí") —
 * UI to smí kreslit jako stezku, ale pravidlem jsou hvězdy.
 */
export function campaignAccess(
  camp: Campaign,
  categoryStarsEarned: number,
  entitlements: Entitlements | null | undefined,
  cat?: CampaignCategory,
): AccessResult {
  // Premium kategorie zpremiovává i své kampaně
  const isPremium = camp.is_premium || !!cat?.is_premium
  return canAccessContent(
    { requiredStars: camp.required_category_stars, isPremium },
    { stars: categoryStarsEarned, entitlements },
  )
}

/** Součet získaných ★ v kategorii + maximum, které v ní jde získat. */
export function categoryStars(
  campaigns: Campaign[],
  progress: Record<string, UserCampaignProgress>,
): { earned: number; max: number } {
  let earned = 0
  for (const c of campaigns) earned += progress[c.id]?.best_stars ?? 0
  return { earned, max: campaigns.length * 3 }
}

/** Globální ★ = součet nejlepších výsledků ze všech kampaní. */
export function globalStars(progress: Record<string, UserCampaignProgress>): number {
  return Object.values(progress).reduce((s, p) => s + (p.best_stars ?? 0), 0)
}

/**
 * Kategorie se hráči ukáže jen s publikovaným obsahem — prázdná se NEZOBRAZUJE
 * jako běžná zamčená (zadání: „Skrytá").
 */
export function isCategoryVisible(cat: CampaignCategory, campaigns: Campaign[]): boolean {
  if (cat.status !== 'published') return false
  return campaigns.some(c => c.status === 'published')
}
