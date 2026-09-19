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
 * ve Vercelu. Dokud není nastaven, AdSense je vypnutý.
 */
export const ADSENSE_CLIENT = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined) || ''

/** Nitro (NitroPay) site ID. Skript se načítá jako `ads-<SITE_ID>.js`. */
export const NITRO_SITE_ID = (import.meta.env.VITE_NITRO_SITE_ID as string | undefined) || ''

/** Který poskytovatel je nakonfigurovaný. Nitro má přednost, když je nastaven. */
export type AdProvider = 'nitro' | 'adsense'
export const AD_PROVIDER: AdProvider | null = NITRO_SITE_ID ? 'nitro' : (ADSENSE_CLIENT ? 'adsense' : null)

/**
 * Přepínač pro celou appku. Reklamy se zapnou automaticky, jakmile je v env
 * vyplněn některý poskytovatel (`VITE_NITRO_SITE_ID` nebo `VITE_ADSENSE_CLIENT`).
 */
export const AD_ENABLED = AD_PROVIDER !== null

/** Slot/Ad-unit ID pro dané umístění u AKTUÁLNÍHO poskytovatele. Prázdné = nezobrazí se. */
export function adSlotId(placement: AdPlacement): string {
  const env = import.meta.env as Record<string, string | undefined>
  const adsense: Record<AdPlacement, string | undefined> = {
    after_game_finished: env.VITE_ADSENSE_SLOT_AFTER_GAME,
    after_campaign_finished: env.VITE_ADSENSE_SLOT_AFTER_CAMPAIGN,
    overview_screen: env.VITE_ADSENSE_SLOT_OVERVIEW,
    before_next_game: env.VITE_ADSENSE_SLOT_BEFORE_NEXT,
  }
  const nitro: Record<AdPlacement, string | undefined> = {
    after_game_finished: env.VITE_NITRO_UNIT_AFTER_GAME,
    after_campaign_finished: env.VITE_NITRO_UNIT_AFTER_CAMPAIGN,
    overview_screen: env.VITE_NITRO_UNIT_OVERVIEW,
    before_next_game: env.VITE_NITRO_UNIT_BEFORE_NEXT,
  }
  return (AD_PROVIDER === 'nitro' ? nitro[placement] : adsense[placement]) || ''
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
