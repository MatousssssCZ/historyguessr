import { describe, it, expect } from 'vitest'
import { computeDailyStreak } from './streak'
import { streakUnlocks } from './achievements'
import { localDateISO } from './supabase'

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localDateISO(d)
}

describe('computeDailyStreak', () => {
  it('0 když nic nehráno', () => {
    expect(computeDailyStreak(new Set())).toBe(0)
  })
  it('počítá souvislou sérii končící dneškem', () => {
    const s = new Set([isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(2)])
    expect(computeDailyStreak(s)).toBe(3)
  })
  it('počítá sérii končící včerejškem (dnešek ještě nehrán)', () => {
    const s = new Set([isoDaysAgo(1), isoDaysAgo(2)])
    expect(computeDailyStreak(s)).toBe(2)
  })
  it('mezera sérii ukončí', () => {
    const s = new Set([isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(3)])
    expect(computeDailyStreak(s)).toBe(2)
  })
})

describe('streakUnlocks', () => {
  it('vrátí milník překročený přechodem 6→7', () => {
    const u = streakUnlocks(6, 7)
    expect(u.map(x => x.name)).toEqual(['Týden v kuse'])
  })
  it('nic, když se žádný milník nepřekročil (7→8)', () => {
    expect(streakUnlocks(7, 8)).toEqual([])
  })
  it('víc milníků naráz (make-up skok 2→14)', () => {
    const u = streakUnlocks(2, 14)
    expect(u.map(x => x.name)).toEqual(['Zapálený', 'Týden v kuse', 'Dva týdny'])
  })
})
