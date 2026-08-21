import { describe, it, expect } from 'vitest'
import { slugify, uniqueSlug } from './slugify'

describe('slugify', () => {
  it('odstraní českou diakritiku', () => {
    expect(slugify('Křišťálová noc')).toBe('kristalova-noc')
    expect(slugify('Přistání na Měsíci')).toBe('pristani-na-mesici')
    expect(slugify('Dobytí Konstantinopole')).toBe('dobyti-konstantinopole')
  })

  it('zvládá německé znaky', () => {
    expect(slugify('Straße des 17. Juni')).toBe('strasse-des-17-juni')
  })

  it('kolabuje interpunkci a mezery na jednu pomlčku', () => {
    expect(slugify('Mnichovská dohoda — zrada?')).toBe('mnichovska-dohoda-zrada')
    expect(slugify('  A  B  ')).toBe('a-b')
  })

  it('nezanechá pomlčky na krajích', () => {
    expect(slugify('!!! test !!!')).toBe('test')
  })

  it('prázdný vstup → prázdný řetězec', () => {
    expect(slugify('')).toBe('')
    expect(slugify(null as unknown as string)).toBe('')
  })
})

describe('uniqueSlug', () => {
  it('přidá číselný sufix při kolizi', () => {
    const used = new Set<string>()
    expect(uniqueSlug('Bitva', used)).toBe('bitva')
    expect(uniqueSlug('Bitva', used)).toBe('bitva-2')
    expect(uniqueSlug('Bitva', used)).toBe('bitva-3')
  })

  it('použije fallback pro prázdný název', () => {
    const used = new Set<string>()
    expect(uniqueSlug('', used, 'udalost')).toBe('udalost')
  })
})
