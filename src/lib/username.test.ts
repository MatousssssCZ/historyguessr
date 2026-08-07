import { describe, it, expect } from 'vitest'
import { validateUsername } from './username'

describe('validateUsername', () => {
  it('přijme běžné jméno', () => {
    expect(validateUsername('Matouš_99').ok).toBe(true)
    expect(validateUsername('Petr Novák').ok).toBe(true)
  })

  it('ořeže okraje a srazí mezery', () => {
    expect(validateUsername('  Petr   Novák ').value).toBe('Petr Novák')
  })

  it('odmítne krátké / dlouhé', () => {
    expect(validateUsername('ab').error).toBe('tooShort')
    expect(validateUsername('a'.repeat(21)).error).toBe('tooLong')
  })

  it('odmítne emoji a speciální znaky', () => {
    expect(validateUsername('Petr😀').error).toBe('invalid')
    expect(validateUsername('a*b/c').error).toBe('invalid')
  })

  it('odmítne rezervovaná jména (vč. variací)', () => {
    expect(validateUsername('admin').error).toBe('reserved')
    expect(validateUsername('A.D.M.I.N').error).toBe('reserved')
    expect(validateUsername('Historyguesser').error).toBe('reserved')
  })

  it('odmítne vulgarity (vč. prokládání a leetspeak)', () => {
    expect(validateUsername('f.u.c.k').error).toBe('profane')
    expect(validateUsername('Sh1t').error).toBe('profane')
    expect(validateUsername('kurva').error).toBe('profane')
  })
})
