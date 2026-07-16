// Centrální vrstva práv (Free / Premium).
//
// PRAVIDLO: tenhle modul je JEDINÉ místo, kde se rozhoduje, co Free a Premium smí.
// Nikdy nerozepisuj podmínky typu `if (isPremium)` přímo do komponent.
//
// POZOR: klient je pouze pro UI (co zobrazit/zašednout). Autorita je vždy server —
// viz migrace 030 (funkce public.is_premium) a serverové kontroly u kampaní.

export type Tier = 'free' | 'premium'

export interface Entitlements {
  isPremium: boolean
  /** null + isPremium = trvalé; jinak datum expirace */
  premiumUntil: string | null
}

export const FREE_ENTITLEMENTS: Entitlements = { isPremium: false, premiumUntil: null }

/** Kolik událostí smí Free hráč vyloučit v Single Playeru (Premium = neomezeně). */
export const FREE_EXCLUDE_LIMIT = 10

/** Respektuje expiraci — časově omezené Premium po datu už neplatí. */
export function isPremiumUser(e: Entitlements | null | undefined, now: Date = new Date()): boolean {
  if (!e?.isPremium) return false
  if (!e.premiumUntil) return true
  return new Date(e.premiumUntil).getTime() > now.getTime()
}

export function tierOf(e: Entitlements | null | undefined, now?: Date): Tier {
  return isPremiumUser(e, now) ? 'premium' : 'free'
}

/** Reklamy vidí jen Free. Kde se smí zobrazit, řeší volající (nikdy během hry). */
export function shouldShowAds(e: Entitlements | null | undefined, now?: Date): boolean {
  return !isPremiumUser(e, now)
}

// ─── Single Player ────────────────────────────────────────
//
// Migrační pravidlo: kategorie a základní vylučování událostí jsou dnes dostupné
// všem — Free si je PONECHÁVÁ, aby stávajícím hráčům nezmizely funkce.
// Premium přidává nové schopnosti navrch, neodebírá staré.

export type SinglePlayerFeature =
  | 'yearRange'          // rozsah let
  | 'roundCount'         // počet kol
  | 'categories'         // filtr kategorií
  | 'excludeEvents'      // vyloučení událostí (Free omezeně)
  | 'unlimitedExclude'   // neomezený blacklist
  | 'exactEvents'        // výběr konkrétních událostí
  | 'onlyUnplayed'       // jen dosud nehrané
  | 'onlyMistakes'       // jen dříve chybně určené
  | 'favorites'          // jen oblíbené
  | 'savePresets'        // uložené scénáře
  | 'sharePresets'       // sdílení scénáře odkazem
  | 'continent'          // filtr kontinentu (až bude spolehlivý)

const FREE_FEATURES: ReadonlySet<SinglePlayerFeature> = new Set<SinglePlayerFeature>([
  'yearRange', 'roundCount', 'categories', 'excludeEvents',
])

export function canUseSinglePlayerFeature(
  feature: SinglePlayerFeature,
  e: Entitlements | null | undefined,
  now?: Date,
): boolean {
  if (isPremiumUser(e, now)) return true
  return FREE_FEATURES.has(feature)
}

export interface SinglePlayerCapabilities {
  canFilterByCategories: boolean
  canSelectExactEvents: boolean
  canExcludeEvents: boolean
  /** null = neomezeně */
  excludeLimit: number | null
  canFilterByContinent: boolean
  canUseSmartFilters: boolean   // nehrané / chybné / oblíbené
  canSavePresets: boolean
  canSharePresets: boolean
}

/** Jeden objekt pro frontend — komponenty nemají skládat pravidla znovu. */
export function singlePlayerCapabilities(e: Entitlements | null | undefined, now?: Date): SinglePlayerCapabilities {
  const premium = isPremiumUser(e, now)
  return {
    canFilterByCategories: true,                 // Free i Premium (migrace bez regrese)
    canExcludeEvents: true,                      // Free i Premium
    excludeLimit: premium ? null : FREE_EXCLUDE_LIMIT,
    canSelectExactEvents: premium,
    canFilterByContinent: premium,
    canUseSmartFilters: premium,
    canSavePresets: premium,
    canSharePresets: premium,
  }
}

export function canSaveSinglePlayerPreset(e: Entitlements | null | undefined, now?: Date): boolean {
  return canUseSinglePlayerFeature('savePresets', e, now)
}

export function canShareSinglePlayerPreset(e: Entitlements | null | undefined, now?: Date): boolean {
  return canUseSinglePlayerFeature('sharePresets', e, now)
}

// ─── Kampaně ──────────────────────────────────────────────
//
// Čisté funkce — data (hvězdy, premium příznak obsahu) dodá volající.
// Premium NIKDY neobchází hvězdné požadavky; pouze zpřístupňuje Premium obsah.

export type LockReason = 'stars' | 'premium' | null

export interface AccessResult {
  /** Obsah je vidět (i zamčený se ukazuje jako ukázka) */
  isVisible: boolean
  isUnlocked: boolean
  lockReason: LockReason
  missingStars: number
}

export function canAccessContent(
  content: { requiredStars: number; isPremium: boolean },
  ctx: { stars: number; entitlements: Entitlements | null | undefined },
  now?: Date,
): AccessResult {
  const missingStars = Math.max(0, content.requiredStars - ctx.stars)
  const starsOk = missingStars === 0
  const premiumOk = !content.isPremium || isPremiumUser(ctx.entitlements, now)

  // Hvězdy mají přednost v hlášení — Premium nikdy hvězdy neobchází.
  const lockReason: LockReason = !starsOk ? 'stars' : (!premiumOk ? 'premium' : null)
  return { isVisible: true, isUnlocked: starsOk && premiumOk, lockReason, missingStars }
}
