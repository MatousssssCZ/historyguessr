import i18n from '@/i18n'
import { currentLocale } from '@/i18n'
const MAX_SCORE = 500

// Ladicí konstanty exponenciálního poklesu (vyšší = mírnější)
const DIST_DECAY_KM = 1500   // poloha: skóre = MAX · e^(−km / 1500)
const YEAR_DECAY = 240       // rok:    skóre = MAX · e^(−roky / 240)

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

function toRad(deg: number) { return (deg * Math.PI) / 180 }

export function locationScore(distKm: number, radiusKm = 0): number {
  const over = Math.max(0, distKm - radiusKm)
  // Exponenciální pokles — přesnost se vyplácí, velké omyly se propadnou
  return Math.round(MAX_SCORE * Math.exp(-over / DIST_DECAY_KM))
}

export function yearScore(guessYear: number, yearFrom: number, yearTo: number): number {
  if (guessYear >= yearFrom && guessYear <= yearTo) return MAX_SCORE
  const over = guessYear < yearFrom ? yearFrom - guessYear : guessYear - yearTo
  return Math.round(MAX_SCORE * Math.exp(-over / YEAR_DECAY))
}

export function yearDiff(guessYear: number, yearFrom: number, yearTo: number): number {
  if (guessYear >= yearFrom && guessYear <= yearTo) return 0
  return guessYear < yearFrom ? yearFrom - guessYear : guessYear - yearTo
}

export function roundScore(distKm: number, guessYear: number, yearFrom: number, yearTo: number, radiusKm = 0) {
  const loc = locationScore(distKm, radiusKm)
  const yr = yearScore(guessYear, yearFrom, yearTo)
  return { location_score: loc, year_score: yr, round_score: loc + yr }
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 100) return `${km.toFixed(1)} km`
  return `${Math.round(km).toLocaleString(currentLocale())} km`
}

export function formatYear(year: number): string {
  const lng = (i18n.language || 'en').slice(0, 2)
  const bc = lng === 'en' ? 'BC' : lng === 'de' ? 'v. Chr.' : 'př. n. l.'
  const ad = lng === 'en' ? 'AD' : lng === 'de' ? 'n. Chr.' : 'n. l.'
  if (year < 0) return `${Math.abs(year)} ${bc}`
  return `${year} ${ad}`
}

export function scorePercent(score: number, maxScore = 1_000): number {
  return Math.round((score / maxScore) * 100)
}
