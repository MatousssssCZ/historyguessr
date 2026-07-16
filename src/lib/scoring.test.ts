import { describe, it, expect } from 'vitest'
import { haversineKm, locationScore, yearScore, yearDiff, roundScore, scorePercent } from './scoring'

const MAX_COMPONENT = 500
const MAX_ROUND = 1000

describe('haversineKm', () => {
  it('stejný bod = 0 km', () => {
    expect(haversineKm(50.08, 14.44, 50.08, 14.44)).toBe(0)
  })

  it('Praha → Brno ≈ 185 km', () => {
    const d = haversineKm(50.0755, 14.4378, 49.1951, 16.6068)
    expect(d).toBeGreaterThan(180)
    expect(d).toBeLessThan(190)
  })

  it('je symetrická', () => {
    const a = haversineKm(50.0755, 14.4378, 49.1951, 16.6068)
    const b = haversineKm(49.1951, 16.6068, 50.0755, 14.4378)
    expect(a).toBeCloseTo(b, 6)
  })
})

describe('locationScore', () => {
  it('přesný zásah = plný počet', () => {
    expect(locationScore(0)).toBe(MAX_COMPONENT)
  })

  it('uvnitř radiusu = plný počet', () => {
    expect(locationScore(250, 300)).toBe(MAX_COMPONENT)
    expect(locationScore(300, 300)).toBe(MAX_COMPONENT)
  })

  it('těsně za radiusem už klesá', () => {
    expect(locationScore(600, 300)).toBeLessThan(MAX_COMPONENT)
  })

  it('klesá s rostoucí vzdáleností a nikdy není záporné', () => {
    expect(locationScore(1500)).toBeLessThan(locationScore(500))
    expect(locationScore(20000)).toBeGreaterThanOrEqual(0)
  })
})

describe('yearScore', () => {
  it('uvnitř rozsahu = plný počet', () => {
    expect(yearScore(1500, 1400, 1600)).toBe(MAX_COMPONENT)
    expect(yearScore(1400, 1400, 1600)).toBe(MAX_COMPONENT)
    expect(yearScore(1600, 1400, 1600)).toBe(MAX_COMPONENT)
  })

  it('mimo rozsah klesá symetricky', () => {
    const before = yearScore(1300, 1400, 1600)
    const after = yearScore(1700, 1400, 1600)
    expect(before).toBe(after)
    expect(before).toBeLessThan(MAX_COMPONENT)
  })

  it('funguje i pro roky př. n. l.', () => {
    expect(yearScore(-500, -500, -500)).toBe(MAX_COMPONENT)
    expect(yearScore(-400, -500, -500)).toBeLessThan(MAX_COMPONENT)
  })
})

describe('yearDiff', () => {
  it('uvnitř rozsahu = 0', () => {
    expect(yearDiff(1500, 1400, 1600)).toBe(0)
  })

  it('vrací počet let mimo rozsah', () => {
    expect(yearDiff(1300, 1400, 1600)).toBe(100)
    expect(yearDiff(1700, 1400, 1600)).toBe(100)
  })
})

describe('roundScore', () => {
  it('perfektní kolo = 1000 bodů', () => {
    const r = roundScore(0, 1500, 1400, 1600)
    expect(r.location_score).toBe(MAX_COMPONENT)
    expect(r.year_score).toBe(MAX_COMPONENT)
    expect(r.round_score).toBe(MAX_ROUND)
  })

  it('round_score je součet složek a nepřekročí maximum', () => {
    const r = roundScore(800, 1200, 1400, 1600, 100)
    expect(r.round_score).toBe(r.location_score + r.year_score)
    expect(r.round_score).toBeLessThanOrEqual(MAX_ROUND)
  })

  it('respektuje radius události', () => {
    const bez = roundScore(400, 1500, 1400, 1600, 0)
    const s = roundScore(400, 1500, 1400, 1600, 500)
    expect(s.location_score).toBeGreaterThan(bez.location_score)
  })
})

describe('scorePercent', () => {
  it('počítá procenta z maxima', () => {
    expect(scorePercent(500, 1000)).toBe(50)
    expect(scorePercent(1000, 1000)).toBe(100)
  })
})
