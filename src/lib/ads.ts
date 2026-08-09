// Abstrakce reklam.
//
// PRAVIDLO: herní komponenty o reklamách nic nevědí. Ptají se jen
// `shouldShowAdAt(placement, entitlements)` — kde a kdy se smí zobrazit,
// rozhoduje tenhle modul.
//
// V první verzi se reklamy reálně nezobrazují (žádná síť není napojená);
// architektura je ale připravená a zákazy jsou vynucené typem.
import { shouldShowAds, type Entitlements } from './entitlements'

/**
 * Místa, kde se reklama SMÍ objevit. Záměrně je to uzavřený výčet —
 * nové místo musí projít revizí, ne se propašovat do komponenty.
 */
export type AdPlacement =
  | 'after_game_finished'      // po dokončení celé běžné hry
  | 'after_campaign_finished'  // po dokončení celé kampaně
  | 'overview_screen'          // přehledové obrazovky (menu, statistiky)
  | 'before_next_game'         // před spuštěním další samostatné hry

/**
 * Místa, kde reklama NIKDY být nesmí (zadání bod 13). Není to jen dokumentace —
 * `assertAdFreeZone()` v dev buildu upozorní, kdyby to někdo obešel.
 */
export const AD_FREE_ZONES = [
  'panorama_view',        // prohlížení panoramatu
  'answer_input',         // zadávání odpovědi
  'between_campaign_rounds', // mezi koly kampaně
  'result_screen',        // překrytí výsledku před přečtením
  'multiplayer_round',    // aktivní kolo multiplayeru
] as const
export type AdFreeZone = typeof AD_FREE_ZONES[number]

/** Smí se na daném místě zobrazit reklama tomuto uživateli? */
export function shouldShowAdAt(
  placement: AdPlacement,
  entitlements: Entitlements | null | undefined,
  now?: Date,
): boolean {
  // Premium = bez reklam, kdekoli
  if (!shouldShowAds(entitlements, now)) return false
  // Zatím žádná reklamní síť — až bude, povolí se tady
  return AD_ENABLED && ALLOWED_PLACEMENTS.has(placement)
}

/**
 * Publisher ID z AdSense (`ca-pub-…`). Žije jen v env — na produkci
 * ve Vercelu. Dokud není nastaven, reklamy jsou globálně vypnuté.
 */
export const ADSENSE_CLIENT = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined) || ''

/**
 * Přepínač pro celou appku. Reklamy se zapnou automaticky, jakmile je
 * v env vyplněn `VITE_ADSENSE_CLIENT` (tj. po schválení AdSense).
 */
export const AD_ENABLED = !!ADSENSE_CLIENT

/** Slot ID pro dané umístění (z AdSense → Ad units). Prázdné = nezobrazí se. */
export function adSlotId(placement: AdPlacement): string {
  const map: Record<AdPlacement, string | undefined> = {
    after_game_finished: import.meta.env.VITE_ADSENSE_SLOT_AFTER_GAME as string | undefined,
    after_campaign_finished: import.meta.env.VITE_ADSENSE_SLOT_AFTER_CAMPAIGN as string | undefined,
    overview_screen: import.meta.env.VITE_ADSENSE_SLOT_OVERVIEW as string | undefined,
    before_next_game: import.meta.env.VITE_ADSENSE_SLOT_BEFORE_NEXT as string | undefined,
  }
  return map[placement] || ''
}

const ALLOWED_PLACEMENTS: ReadonlySet<AdPlacement> = new Set<AdPlacement>([
  'after_game_finished',
  'after_campaign_finished',
  'overview_screen',
  'before_next_game',
])

/**
 * Pojistka pro vývoj: volej v místech, kde reklama nesmí být.
 * V produkci nic nedělá, v dev buildu křikne, kdyby se tam reklama dostala.
 */
export function assertAdFreeZone(zone: AdFreeZone): void {
  if (import.meta.env.DEV && AD_ENABLED) {
    console.assert(
      AD_FREE_ZONES.includes(zone),
      `[ads] „${zone}" musí zůstat bez reklam (zadání bod 13).`,
    )
  }
}
