import { describe, it, expect } from 'vitest'
import { continentOf, type Continent } from './continent'

// [lat, lng, očekávaný kontinent]
const CITIES: [string, number, number, Continent][] = [
  ['Praha', 50.08, 14.44, 'Europe'],
  ['Londýn', 51.51, -0.13, 'Europe'],
  ['Řím', 41.90, 12.50, 'Europe'],
  ['Madrid', 40.42, -3.70, 'Europe'],
  ['Tokio', 35.68, 139.69, 'Asia'],
  ['Dillí', 28.61, 77.21, 'Asia'],
  ['Peking', 39.90, 116.40, 'Asia'],
  ['Bangkok', 13.76, 100.50, 'Asia'],
  ['Káhira', 30.04, 31.24, 'Africa'],
  ['Lagos', 6.52, 3.38, 'Africa'],
  ['Johannesburg', -26.20, 28.05, 'Africa'],
  ['New York', 40.71, -74.01, 'North America'],
  ['Mexico City', 19.43, -99.13, 'North America'],
  ['Los Angeles', 34.05, -118.24, 'North America'],
  ['Rio de Janeiro', -22.91, -43.17, 'South America'],
  ['Buenos Aires', -34.60, -58.38, 'South America'],
  ['Lima', -12.05, -77.04, 'South America'],
  ['Sydney', -33.87, 151.21, 'Oceania'],
  ['Auckland', -36.85, 174.76, 'Oceania'],
]

describe('continentOf — velká města padnou správně a jistě', () => {
  for (const [name, lat, lng, expected] of CITIES) {
    it(`${name} → ${expected}`, () => {
      const r = continentOf(lat, lng)
      expect(r.continent).toBe(expected)
      expect(r.confident).toBe(true)
    })
  }
})

describe('continentOf — Antarktida', () => {
  it('vnitřek je jistý', () => {
    const r = continentOf(-77.85, 166.67) // McMurdo
    expect(r.continent).toBe('Antarctica')
    expect(r.confident).toBe(true)
  })
})

describe('continentOf — nevalidní vstup', () => {
  it('nulový ostrov (0,0) = neznámé', () => {
    expect(continentOf(0, 0)).toEqual({ continent: null, confident: false })
  })
  it('mimo rozsah = neznámé', () => {
    expect(continentOf(999, 999).continent).toBeNull()
    expect(continentOf(NaN, 10).continent).toBeNull()
  })
})

describe('continentOf — oceán = nejisté (žádný kontinent)', () => {
  it('střed Atlantiku', () => {
    const r = continentOf(0, -30)
    expect(r.confident).toBe(false)
  })
  it('střed Pacifiku', () => {
    const r = continentOf(0, -150)
    expect(r.confident).toBe(false)
  })
})
