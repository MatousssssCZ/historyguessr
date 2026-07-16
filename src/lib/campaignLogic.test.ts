import { describe, it, expect } from 'vitest'
import {
  starsForScore, effectiveEnergy, isCategoryUnlocked, isCampaignUnlocked, categoryStars,
  DAILY_ENERGY, STAR_THRESHOLDS,
} from './campaignLogic'
import type { CampaignCategory, Campaign, UserCampaignProgress } from '@/types/database'

// ── pomocné továrničky ──
const cat = (p: Partial<CampaignCategory> = {}): CampaignCategory => ({
  id: 'c1', seq: 0, slug: null, title: 'Kategorie', title_en: null, title_de: null,
  description: null, icon: null, color: null, unlock_stars: 0, is_premium: false,
  published: true, created_at: '', updated_at: '', ...p,
})
const camp = (id: string, p: Partial<Campaign> = {}): Campaign => ({
  id, category_id: 'c1', seq: 0, title: id, title_en: null, title_de: null,
  description: null, unlock_stars: 0, published: true, created_at: '', updated_at: '', ...p,
})
const prog = (campaignId: string, stars: number): UserCampaignProgress => ({
  user_id: 'u1', campaign_id: campaignId, best_score: stars * 1500, stars,
  attempts_used: 1, completed_at: null,
})

describe('starsForScore — hranice dle zadání', () => {
  it('0–1999 bodů = 0 hvězd', () => {
    expect(starsForScore(0)).toBe(0)
    expect(starsForScore(1999)).toBe(0)
  })

  it('2000–3249 bodů = 1 hvězda', () => {
    expect(starsForScore(2000)).toBe(1)
    expect(starsForScore(3249)).toBe(1)
  })

  it('3250–4249 bodů = 2 hvězdy', () => {
    expect(starsForScore(3250)).toBe(2)
    expect(starsForScore(4249)).toBe(2)
  })

  it('4250–5000 bodů = 3 hvězdy', () => {
    expect(starsForScore(4250)).toBe(3)
    expect(starsForScore(5000)).toBe(3)
  })

  it('prahy odpovídají konstantám (jediný zdroj pravdy)', () => {
    expect(STAR_THRESHOLDS).toEqual([2000, 3250, 4250])
  })
})

describe('effectiveEnergy', () => {
  const today = new Date().toISOString().slice(0, 10)

  it('premium má neomezeně', () => {
    expect(effectiveEnergy(0, today, true)).toBe(Infinity)
  })

  it('bez záznamu resetu = plný denní příděl', () => {
    expect(effectiveEnergy(2, null, false)).toBe(DAILY_ENERGY)
  })

  it('starý reset (včerejšek) = obnovený příděl', () => {
    expect(effectiveEnergy(0, '2020-01-01', false)).toBe(DAILY_ENERGY)
  })

  it('dnešní reset = zbývající energie', () => {
    expect(effectiveEnergy(2, today, false)).toBe(2)
    expect(effectiveEnergy(0, today, false)).toBe(0)
  })
})

describe('isCategoryUnlocked', () => {
  it('první kategorie (0★) je otevřená hned', () => {
    expect(isCategoryUnlocked(cat({ unlock_stars: 0 }), 0, false)).toBe(true)
  })

  it('zamčená, když nemá dost globálních hvězd', () => {
    expect(isCategoryUnlocked(cat({ unlock_stars: 8 }), 7, false)).toBe(false)
    expect(isCategoryUnlocked(cat({ unlock_stars: 8 }), 8, false)).toBe(true)
  })

  it('premium kategorie vyžaduje premium účet', () => {
    expect(isCategoryUnlocked(cat({ is_premium: true }), 100, false)).toBe(false)
    expect(isCategoryUnlocked(cat({ is_premium: true }), 100, true)).toBe(true)
  })

  it('premium NEobchází hvězdný požadavek', () => {
    expect(isCategoryUnlocked(cat({ is_premium: true, unlock_stars: 10 }), 3, true)).toBe(false)
  })
})

describe('isCampaignUnlocked (současné sekvenční chování)', () => {
  const list = [camp('a'), camp('b'), camp('c')]

  it('první kampaň je vždy odemčená', () => {
    expect(isCampaignUnlocked(list, 0, {})).toBe(true)
  })

  it('další je zamčená bez dokončení předchozí', () => {
    expect(isCampaignUnlocked(list, 1, {})).toBe(false)
  })

  it('předchozí na 0★ neodemyká', () => {
    expect(isCampaignUnlocked(list, 1, { a: prog('a', 0) })).toBe(false)
  })

  it('předchozí na ≥1★ odemyká', () => {
    expect(isCampaignUnlocked(list, 1, { a: prog('a', 1) })).toBe(true)
  })
})

describe('categoryStars', () => {
  it('sčítá nejlepší hvězdy a počítá maximum', () => {
    const list = [camp('a'), camp('b'), camp('c')]
    const p = { a: prog('a', 3), b: prog('b', 1) }
    expect(categoryStars(list, p)).toEqual({ earned: 4, max: 9 })
  })

  it('prázdná kategorie = 0/0', () => {
    expect(categoryStars([], {})).toEqual({ earned: 0, max: 0 })
  })
})
