import { describe, it, expect } from 'vitest'
import { shouldShowAdAt, AD_ENABLED, AD_FREE_ZONES, type AdPlacement } from './ads'
import { FREE_ENTITLEMENTS, type Entitlements } from './entitlements'

const NOW = new Date('2026-07-01T12:00:00Z')
const free: Entitlements = FREE_ENTITLEMENTS
const premium: Entitlements = { isPremium: true, premiumUntil: null }
const premiumExpired: Entitlements = { isPremium: true, premiumUntil: '2026-06-01T00:00:00Z' }

const ALL_PLACEMENTS: AdPlacement[] = [
  'after_game_finished', 'after_campaign_finished', 'overview_screen', 'before_next_game',
]

describe('reklamy — Premium je nikdy nevidí', () => {
  it('Premium nemá reklamy na žádném místě', () => {
    for (const p of ALL_PLACEMENTS) {
      expect(shouldShowAdAt(p, premium, NOW)).toBe(false)
    }
  })

  it('vypršelé Premium už reklamy vidět může (spadl na Free)', () => {
    // Free = reklamy povolené *pravidly*; reálné zobrazení řídí AD_ENABLED
    for (const p of ALL_PLACEMENTS) {
      expect(shouldShowAdAt(p, premiumExpired, NOW)).toBe(AD_ENABLED)
    }
  })
})

describe('reklamy — první verze je nezobrazuje', () => {
  it('dokud je AD_ENABLED false, nezobrazí se nikomu a nikde', () => {
    expect(AD_ENABLED).toBe(false)
    for (const p of ALL_PLACEMENTS) {
      expect(shouldShowAdAt(p, free, NOW)).toBe(false)
    }
  })
})

describe('reklamy — zakázané zóny (zadání bod 13)', () => {
  it('herní zóny nejsou platná umístění (nejdou ani zapnout)', () => {
    for (const zone of AD_FREE_ZONES) {
      // Typ to zakazuje; tenhle test hlídá i běhové chování, kdyby někdo přetypoval
      expect(shouldShowAdAt(zone as unknown as AdPlacement, free, NOW)).toBe(false)
    }
  })

  it('výčet zakázaných zón pokrývá vše ze zadání', () => {
    expect(AD_FREE_ZONES).toEqual([
      'panorama_view', 'answer_input', 'between_campaign_rounds', 'result_screen', 'multiplayer_round',
    ])
  })
})
