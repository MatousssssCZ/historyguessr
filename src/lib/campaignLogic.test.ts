import { describe, it, expect } from 'vitest'
import {
  starsForScore, starThresholds, maxScoreFor,
  categoryAccess, campaignAccess, categoryStars, globalStars, isCategoryVisible,
  STAR_THRESHOLD_PCT,
} from './campaignLogic'
import { FREE_ENTITLEMENTS, type Entitlements } from './entitlements'
import type { CampaignCategory, Campaign, UserCampaignProgress } from '@/types/database'

const free: Entitlements = FREE_ENTITLEMENTS
const premium: Entitlements = { isPremium: true, premiumUntil: null }

const cat = (p: Partial<CampaignCategory> = {}): CampaignCategory => ({
  id: 'c1', seq: 0, slug: null, title: 'Kategorie', title_en: null, title_de: null,
  description: null, description_en: null, description_de: null, icon: null, color: null,
  hero_image_url: null, required_global_stars: 0, is_premium: false, status: 'published',
  published_at: null, created_at: '', updated_at: '', ...p,
})
const camp = (id: string, p: Partial<Campaign> = {}): Campaign => ({
  id, category_id: 'c1', seq: 0, slug: null, title: id, title_en: null, title_de: null,
  description: null, description_en: null, description_de: null, visual_url: null,
  rounds_count: 5, star_thresholds_pct: null, required_category_stars: 0,
  is_premium: false, status: 'published', published_at: null, created_at: '', updated_at: '', ...p,
})
const prog = (campaignId: string, stars: number): UserCampaignProgress => ({
  user_id: 'u1', campaign_id: campaignId, best_score: stars * 1500, best_stars: stars,
  completed_runs: 1, attempts_count: 1, first_completed_at: null, last_played_at: null,
})

describe('starsForScore — hranice ze zadání (5 kol)', () => {
  it('0–1999 = 0★, 2000–3249 = 1★, 3250–4249 = 2★, 4250–5000 = 3★', () => {
    expect(starsForScore(0)).toBe(0)
    expect(starsForScore(1999)).toBe(0)
    expect(starsForScore(2000)).toBe(1)
    expect(starsForScore(3249)).toBe(1)
    expect(starsForScore(3250)).toBe(2)
    expect(starsForScore(4249)).toBe(2)
    expect(starsForScore(4250)).toBe(3)
    expect(starsForScore(5000)).toBe(3)
  })

  it('relativní prahy dávají pro 5 kol přesně 2000/3250/4250', () => {
    expect(starThresholds(5)).toEqual([2000, 3250, 4250])
    expect(maxScoreFor(5)).toBe(5000)
  })

  it('prahy jsou vždy celá čísla (zaokrouhlení chrání před float driftem)', () => {
    for (const rounds of [1, 3, 5, 7, 10, 13, 20]) {
      for (const t of starThresholds(rounds)) {
        expect(Number.isInteger(t)).toBe(true)
      }
    }
    // hranice musí sedět přesně, ne o 0.0000001 vedle
    expect(starsForScore(3250)).toBe(2)
    expect(STAR_THRESHOLD_PCT).toEqual([0.40, 0.65, 0.85])
  })
})

describe('starsForScore — jiný počet kol (nesmí být natvrdo 5)', () => {
  it('3 kola: max 3000, prahy 1200/1950/2550', () => {
    expect(maxScoreFor(3)).toBe(3000)
    expect(starThresholds(3)).toEqual([1200, 1950, 2550])
    expect(starsForScore(1199, 3)).toBe(0)
    expect(starsForScore(1200, 3)).toBe(1)
    expect(starsForScore(2550, 3)).toBe(3)
  })

  it('10 kol: max 10000, prahy 4000/6500/8500', () => {
    expect(starThresholds(10)).toEqual([4000, 6500, 8500])
    expect(starsForScore(4000, 10)).toBe(1)
    expect(starsForScore(3999, 10)).toBe(0)
  })

  it('vlastní prahy kampaně přebijí výchozí', () => {
    expect(starsForScore(2500, 5, [0.5, 0.7, 0.9])).toBe(1)   // 2500/3500/4500
    expect(starsForScore(2499, 5, [0.5, 0.7, 0.9])).toBe(0)
  })
})

describe('odemykání kategorií (globální ★)', () => {
  it('první kategorie 0★ otevřená hned i pro Free', () => {
    expect(categoryAccess(cat({ required_global_stars: 0 }), 0, free).isUnlocked).toBe(true)
  })

  it('málo hvězd → zamčeno + kolik chybí', () => {
    const r = categoryAccess(cat({ required_global_stars: 8 }), 3, free)
    expect(r.isUnlocked).toBe(false)
    expect(r.lockReason).toBe('stars')
    expect(r.missingStars).toBe(5)
  })

  it('Premium kategorie je pro Free VIDITELNÁ, ale zamčená', () => {
    const r = categoryAccess(cat({ is_premium: true }), 0, free)
    expect(r.isVisible).toBe(true)
    expect(r.isUnlocked).toBe(false)
    expect(r.lockReason).toBe('premium')
  })

  it('Premium NEobchází hvězdy', () => {
    const r = categoryAccess(cat({ required_global_stars: 15, is_premium: true }), 4, premium)
    expect(r.isUnlocked).toBe(false)
    expect(r.lockReason).toBe('stars')
  })
})

describe('odemykání kampaní (★ v kategorii, NE sekvenčně)', () => {
  it('kampaň s 0★ je otevřená', () => {
    expect(campaignAccess(camp('a', { required_category_stars: 0 }), 0, free).isUnlocked).toBe(true)
  })

  it('odemyká se hvězdami, ne dokončením předchozí', () => {
    const c = camp('d', { required_category_stars: 6 })
    expect(campaignAccess(c, 5, free).isUnlocked).toBe(false)
    expect(campaignAccess(c, 6, free).isUnlocked).toBe(true)
  })

  it('hvězdy lze nasbírat i přeskakováním — stačí jejich počet', () => {
    // hráč má 9★ z jiných kampaní kategorie → poslední kampaň je otevřená
    expect(campaignAccess(camp('e', { required_category_stars: 9 }), 9, free).isUnlocked).toBe(true)
  })

  it('Premium kategorie zpremiovává i svoje kampaně', () => {
    const r = campaignAccess(camp('a'), 0, free, cat({ is_premium: true }))
    expect(r.isUnlocked).toBe(false)
    expect(r.lockReason).toBe('premium')
  })

  it('Premium účet + Premium kampaň + dost ★ = hraje', () => {
    const r = campaignAccess(camp('a', { is_premium: true, required_category_stars: 3 }), 3, premium)
    expect(r.isUnlocked).toBe(true)
  })
})

describe('součty hvězd', () => {
  it('kategorie: součet nejlepších + maximum', () => {
    const list = [camp('a'), camp('b'), camp('c')]
    expect(categoryStars(list, { a: prog('a', 3), b: prog('b', 1) })).toEqual({ earned: 4, max: 9 })
  })

  it('globální: součet přes všechny kampaně', () => {
    expect(globalStars({ a: prog('a', 3), b: prog('b', 2), c: prog('c', 0) })).toBe(5)
  })

  it('prázdný postup = 0', () => {
    expect(globalStars({})).toBe(0)
    expect(categoryStars([], {})).toEqual({ earned: 0, max: 0 })
  })
})

describe('viditelnost kategorie', () => {
  it('publikovaná s publikovanou kampaní = vidět', () => {
    expect(isCategoryVisible(cat(), [camp('a')])).toBe(true)
  })

  it('publikovaná BEZ obsahu = skrytá (ne zamčená)', () => {
    expect(isCategoryVisible(cat(), [])).toBe(false)
    expect(isCategoryVisible(cat(), [camp('a', { status: 'draft' })])).toBe(false)
  })

  it('koncept/archiv = skrytá', () => {
    expect(isCategoryVisible(cat({ status: 'draft' }), [camp('a')])).toBe(false)
    expect(isCategoryVisible(cat({ status: 'archived' }), [camp('a')])).toBe(false)
  })
})

describe('přidání nové kampaně nesmí ublížit postupu', () => {
  it('hvězdy zůstávají, maximum kategorie povyroste', () => {
    const before = [camp('a'), camp('b')]
    const p = { a: prog('a', 3), b: prog('b', 2) }
    expect(categoryStars(before, p)).toEqual({ earned: 5, max: 6 })
    const after = [...before, camp('c')]           // admin přidal kampaň
    expect(categoryStars(after, p)).toEqual({ earned: 5, max: 9 })
    expect(globalStars(p)).toBe(5)                  // získané ★ beze změny
  })
})
