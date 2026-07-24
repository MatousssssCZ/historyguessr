import i18n from '@/i18n'
import { currentLocale } from '@/i18n'
const MAX_SCORE = 500

// Rok: exponenciální pokles (vyšší = mírnější)
const YEAR_DECAY = 240       // rok: skóre = MAX · e^(−roky / 240)

// Poloha: 3 lineární zóny místo jedné exponenciály.
//   0–250 km    500 → 450  (skoro trefa — pořád hodně bodů)
//   250–3000 km 450 → 200  (mírný pokles)
//   3000–5000 km 200 → 0    (velký pokles)
//   > 5000 km   0           (jiný kontinent = nula)
// MUSÍ sedět s SQL funkcí score_event_guess (migrace 043).
const DIST_ZONES = [
  { from: 0,    to: 250,  scoreFrom: 500, scoreTo: 450 },
  { from: 250,  to: 3000, scoreFrom: 450, scoreTo: 200 },
  { from: 3000, to: 5000, scoreFrom: 200, scoreTo: 0 },
] as const

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
  for (const z of DIST_ZONES) {
    if (over <= z.to) {
      const t = (over - z.from) / (z.to - z.from)  // 0..1 v rámci zóny
      return Math.round(z.scoreFrom + t * (z.scoreTo - z.scoreFrom))
    }
  }
  return 0  // za poslední zónou (jiný kontinent)
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
