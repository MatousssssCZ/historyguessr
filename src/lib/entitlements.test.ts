import { describe, it, expect } from 'vitest'
import {
  isPremiumUser, tierOf, shouldShowAds, canUseSinglePlayerFeature, singlePlayerCapabilities,
  canSaveSinglePlayerPreset, canShareSinglePlayerPreset, canAccessContent,
  FREE_ENTITLEMENTS, FREE_EXCLUDE_LIMIT, type Entitlements,
} from './entitlements'

const NOW = new Date('2026-07-01T12:00:00Z')
const free: Entitlements = FREE_ENTITLEMENTS
const premiumForever: Entitlements = { isPremium: true, premiumUntil: null }
const premiumActive: Entitlements = { isPremium: true, premiumUntil: '2026-08-01T00:00:00Z' }
const premiumExpired: Entitlements = { isPremium: true, premiumUntil: '2026-06-01T00:00:00Z' }

describe('isPremiumUser', () => {
  it('Free není premium', () => {
    expect(isPremiumUser(free, NOW)).toBe(false)
  })

  it('null/undefined = Free (bezpečný default)', () => {
    expect(isPremiumUser(null, NOW)).toBe(false)
    expect(isPremiumUser(undefined, NOW)).toBe(false)
  })

  it('trvalé premium platí', () => {
    expect(isPremiumUser(premiumForever, NOW)).toBe(true)
  })

  it('časově omezené premium platí do data', () => {
    expect(isPremiumUser(premiumActive, NOW)).toBe(true)
  })

  it('vypršelé premium NEPLATÍ', () => {
    expect(isPremiumUser(premiumExpired, NOW)).toBe(false)
  })

  it('přesně v okamžiku expirace už neplatí', () => {
    const e: Entitlements = { isPremium: true, premiumUntil: NOW.toISOString() }
    expect(isPremiumUser(e, NOW)).toBe(false)
  })
})

describe('tierOf / shouldShowAds', () => {
  it('vrací správný tier', () => {
    expect(tierOf(free, NOW)).toBe('free')
    expect(tierOf(premiumActive, NOW)).toBe('premium')
    expect(tierOf(premiumExpired, NOW)).toBe('free')
  })

  it('reklamy vidí jen Free (vč. vypršelého premia)', () => {
    expect(shouldShowAds(free, NOW)).toBe(true)
    expect(shouldShowAds(premiumExpired, NOW)).toBe(true)
    expect(shouldShowAds(premiumForever, NOW)).toBe(false)
  })
})

describe('Single Player — Free si ponechává stávající funkce (migrace bez regrese)', () => {
  it('Free má rozsah let, počet kol, kategorie i vylučování', () => {
    for (const f of ['yearRange', 'roundCount', 'categories', 'excludeEvents'] as const) {
      expect(canUseSinglePlayerFeature(f, free, NOW)).toBe(true)
    }
  })

  it('Free nemá pokročilé funkce', () => {
    for (const f of ['exactEvents', 'unlimitedExclude', 'onlyUnplayed', 'onlyMistakes', 'favorites', 'savePresets', 'sharePresets', 'continent'] as const) {
      expect(canUseSinglePlayerFeature(f, free, NOW)).toBe(false)
    }
  })

  it('Premium má vše', () => {
    for (const f of ['yearRange', 'exactEvents', 'savePresets', 'sharePresets', 'continent'] as const) {
      expect(canUseSinglePlayerFeature(f, premiumActive, NOW)).toBe(true)
    }
  })

  it('vypršelé premium spadne na Free schopnosti', () => {
    expect(canUseSinglePlayerFeature('savePresets', premiumExpired, NOW)).toBe(false)
    expect(canUseSinglePlayerFeature('categories', premiumExpired, NOW)).toBe(true)
  })

  it('capabilities: Free má limit blacklistu, Premium neomezeně', () => {
    expect(singlePlayerCapabilities(free, NOW).excludeLimit).toBe(FREE_EXCLUDE_LIMIT)
    expect(singlePlayerCapabilities(premiumActive, NOW).excludeLimit).toBeNull()
  })

  it('capabilities: kategorie zůstávají oběma', () => {
    expect(singlePlayerCapabilities(free, NOW).canFilterByCategories).toBe(true)
    expect(singlePlayerCapabilities(premiumActive, NOW).canFilterByCategories).toBe(true)
  })

  it('presety jen Premium', () => {
    expect(canSaveSinglePlayerPreset(free, NOW)).toBe(false)
    expect(canShareSinglePlayerPreset(free, NOW)).toBe(false)
    expect(canSaveSinglePlayerPreset(premiumActive, NOW)).toBe(true)
    expect(canShareSinglePlayerPreset(premiumActive, NOW)).toBe(true)
  })
})

describe('canAccessContent — Premium NEobchází hvězdy', () => {
  it('Free obsah s dostatkem hvězd = odemčeno', () => {
    const r = canAccessContent({ requiredStars: 3, isPremium: false }, { stars: 5, entitlements: free }, NOW)
    expect(r).toEqual({ isVisible: true, isUnlocked: true, lockReason: null, missingStars: 0 })
  })

  it('nedostatek hvězd = zamčeno hvězdami + počet chybějících', () => {
    const r = canAccessContent({ requiredStars: 8, isPremium: false }, { stars: 3, entitlements: free }, NOW)
    expect(r.isUnlocked).toBe(false)
    expect(r.lockReason).toBe('stars')
    expect(r.missingStars).toBe(5)
  })

  it('Premium obsah pro Free = zamčeno premiem, ale VIDITELNÉ (ukázka)', () => {
    const r = canAccessContent({ requiredStars: 0, isPremium: true }, { stars: 0, entitlements: free }, NOW)
    expect(r.isVisible).toBe(true)
    expect(r.isUnlocked).toBe(false)
    expect(r.lockReason).toBe('premium')
  })

  it('Premium účet NEobejde hvězdný požadavek', () => {
    const r = canAccessContent({ requiredStars: 10, isPremium: true }, { stars: 2, entitlements: premiumForever }, NOW)
    expect(r.isUnlocked).toBe(false)
    expect(r.lockReason).toBe('stars')
    expect(r.missingStars).toBe(8)
  })

  it('Premium účet + Premium obsah + dost hvězd = odemčeno', () => {
    const r = canAccessContent({ requiredStars: 10, isPremium: true }, { stars: 10, entitlements: premiumActive }, NOW)
    expect(r.isUnlocked).toBe(true)
    expect(r.lockReason).toBeNull()
  })

  it('vypršelé premium ztrácí přístup k Premium obsahu', () => {
    const r = canAccessContent({ requiredStars: 0, isPremium: true }, { stars: 0, entitlements: premiumExpired }, NOW)
    expect(r.isUnlocked).toBe(false)
    expect(r.lockReason).toBe('premium')
  })

  it('první kategorie (0★) je pro Free otevřená', () => {
    const r = canAccessContent({ requiredStars: 0, isPremium: false }, { stars: 0, entitlements: free }, NOW)
    expect(r.isUnlocked).toBe(true)
  })
})
