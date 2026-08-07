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

  it('odmítne vulgarity (vč. prokládání, leetspeak a diakritiky)', () => {
    expect(validateUsername('f.u.c.k').error).toBe('profane')
    expect(validateUsername('Sh1t').error).toBe('profane')
    expect(validateUsername('kurva').error).toBe('profane')
    expect(validateUsername('Piča').error).toBe('profane')
  })

  it('neblokuje legitimní jména (žádné falešné shody)', () => {
    expect(validateUsername('Ignazio').ok).toBe(true)   // obsahuje „nazi"
    expect(validateUsername('Draper').ok).toBe(true)    // obsahuje „rape"
    expect(validateUsername('Cigánek').ok).toBe(true)   // obsahuje „cigan"
  })

  it('krátká kolizní slova blokuje jen jako celé jméno', () => {
    expect(validateUsername('rape').error).toBe('profane')
    expect(validateUsername('Draperape').ok).toBe(true)
  })
})
