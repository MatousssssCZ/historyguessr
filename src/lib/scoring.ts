/**
 * Výpočet skóre pro HistoryGuessr
 * Max skóre za kolo: 10 000 bodů (5 000 poloha + 5 000 rok)
 * Max celkové skóre: 50 000 bodů (5 kol)
 */

const MAX_LOCATION_SCORE = 5_000
const MAX_YEAR_SCORE = 5_000

/** Haversine vzdálenost mezi dvěma body v kilometrech */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

/** Skóre za polohu — exponenciální pokles, max ~5 000 */
export function locationScore(distKm: number): number {
  if (distKm < 0.05) return MAX_LOCATION_SCORE   // do 50 m = perfektní
  if (distKm > 10_000) return 0
  return Math.round(MAX_LOCATION_SCORE * Math.exp(-distKm / 500))
}

/** Skóre za rok — exponenciální pokles, max 5 000 */
export function yearScore(yearDiff: number): number {
  if (yearDiff === 0) return MAX_YEAR_SCORE
  if (yearDiff > 2000) return 0
  return Math.round(MAX_YEAR_SCORE * Math.exp(-yearDiff / 100))
}

/** Celkové skóre za jedno kolo */
export function roundScore(distKm: number, yearDiff: number) {
  const loc = locationScore(distKm)
  const yr = yearScore(yearDiff)
  return {
    location_score: loc,
    year_score: yr,
    round_score: loc + yr,
  }
}

/** Formátování vzdálenosti pro UI */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 100) return `${km.toFixed(1)} km`
  return `${Math.round(km).toLocaleString('cs-CZ')} km`
}

/** Formátování roku pro UI (BCE/CE) */
export function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} př. n. l.`
  return `${year} n. l.`
}

/** Procento přesnosti (0–100) pro progress bar */
export function scorePercent(score: number, maxScore = 10_000): number {
  return Math.round((score / maxScore) * 100)
}
