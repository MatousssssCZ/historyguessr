import { describe, it, expect } from 'vitest'
import { normalizeRules, validatePreset, DEFAULT_RULES, type PresetRules } from './presets'

const rules = (p: Partial<PresetRules> = {}): PresetRules => ({ ...DEFAULT_RULES, ...p })

describe('normalizeRules — jsonb z DB může být cokoli', () => {
  it('prázdný objekt = výchozí pravidla', () => {
    const r = normalizeRules({})
    expect(r.rounds).toBe(5)
    expect(r.categories).toEqual([])
    expect(r.excludeIds).toEqual([])
  })

  it('null/undefined nespadne', () => {
    expect(normalizeRules(null).rounds).toBe(5)
    expect(normalizeRules(undefined).rounds).toBe(5)
  })

  it('nesmysly zahodí, nepustí je dál', () => {
    const r = normalizeRules({ rounds: 'pět', categories: [1, 'war', null], excludeIds: 'nope' })
    expect(r.rounds).toBe(5)
    expect(r.categories).toEqual(['war'])
    expect(r.excludeIds).toEqual([])
  })

  it('počet kol drží v rozumných mezích', () => {
    expect(normalizeRules({ rounds: 0 }).rounds).toBe(1)
    expect(normalizeRules({ rounds: 999 }).rounds).toBe(20)
  })
})

describe('validatePreset — scénář nesmí zestárnout', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f']

  it('dost událostí = v pořádku, bez varování', () => {
    const v = validatePreset(rules({ rounds: 5 }), pool)
    expect(v.ok).toBe(true)
    expect(v.warnings).toEqual([])
    expect(v.adjusted.rounds).toBe(5)
  })

  it('málo událostí → sníží počet kol a řekne to', () => {
    const v = validatePreset(rules({ rounds: 10 }), pool)
    expect(v.available).toBe(6)
    expect(v.adjusted.rounds).toBe(6)
    expect(v.warnings[0]).toContain('jen 6')
  })

  it('vyloučení se započítá do dostupnosti', () => {
    const v = validatePreset(rules({ rounds: 5, excludeIds: ['a', 'b'] }), pool)
    expect(v.available).toBe(4)
    expect(v.adjusted.rounds).toBe(4)
  })

  it('vyloučení mimo pool tiše zahodí (není to chyba)', () => {
    const v = validatePreset(rules({ rounds: 3, excludeIds: ['a', 'zmizela'] }), pool)
    expect(v.adjusted.excludeIds).toEqual(['a'])
    expect(v.warnings).toEqual([])
  })

  it('prázdný pool = scénář nejde spustit', () => {
    const v = validatePreset(rules({ rounds: 5 }), [])
    expect(v.ok).toBe(false)
    expect(v.available).toBe(0)
  })
})

describe('validatePreset — konkrétní události (explicitní volba hráče)', () => {
  const pool = ['a', 'b', 'c']

  it('všechny dostupné = beze změny', () => {
    const v = validatePreset(rules({ rounds: 3, exactEventIds: ['a', 'b', 'c'] }), pool)
    expect(v.ok).toBe(true)
    expect(v.warnings).toEqual([])
    expect(v.adjusted.exactEventIds).toEqual(['a', 'b', 'c'])
  })

  it('zmizelou událost vynechá a upozorní', () => {
    const v = validatePreset(rules({ rounds: 3, exactEventIds: ['a', 'smazana', 'c'] }), pool)
    expect(v.adjusted.exactEventIds).toEqual(['a', 'c'])
    expect(v.warnings.some(w => w.includes('už není dostupná'))).toBe(true)
    expect(v.adjusted.rounds).toBe(2)   // kol jen tolik, kolik zbylo
  })

  it('když nezbyde nic, scénář nejde spustit', () => {
    const v = validatePreset(rules({ rounds: 2, exactEventIds: ['x', 'y'] }), pool)
    expect(v.ok).toBe(false)
    expect(v.available).toBe(0)
  })
})
