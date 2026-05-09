/**
 * Výpočet skóre pro HistoryGuessr
 * Max skóre za kolo: 10 000 bodů (5 000 poloha + 5 000 rok)
 * Max celkové skóre: 50 000 bodů (5 kol)
 */

const MAX_SCORE = 5_000

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

/**
 * Skóre za polohu
 * - Pokud je distKm <= radius → 5000 bodů (plný počet)
 * - Pak -1 bod za každý km nad radius, minimum 0
 * - Pokud radius = 0, počítá se přesná vzdálenost (exponenciála)
 */
export function locationScore(distKm: number, radiusKm = 0): number {
  if (radiusKm > 0) {
    const over = Math.max(0, distKm - radiusKm)
    return Math.max(0, MAX_SCORE - Math.round(over))
  }
  // Původní exponenciální výpočet pro přesné místo
  if (distKm < 0.05) return MAX_SCORE
  if (distKm > 5_000) return 0
  return Math.round(MAX_SCORE * Math.exp(-distKm / 500))
}

/**
 * Skóre za rok
 * - Pokud je yearDiff <= yearRange → 5000 bodů (plný počet)
 * - Pak -1 bod za každý rok nad yearRange, minimum 0
 * - Pokud yearRange = 0, počítá se přesný rok (exponenciála)
 */
export function yearScore(yearDiff: number, yearRange = 0): number {
  if (yearRange > 0) {
    const over = Math.max(0, yearDiff - yearRange)
    return Math.max(0, MAX_SCORE - Math.round(over))
  }
  // Původní exponenciální výpočet pro přesný rok
  if (yearDiff === 0) return MAX_SCORE
  if (yearDiff > 2000) return 0
  return Math.round(MAX_SCORE * Math.exp(-yearDiff / 100))
}

/** Celkové skóre za jedno kolo */
export function roundScore(distKm: number, yearDiff: number, radiusKm = 0, yearRange = 0) {
  const loc = locationScore(distKm, radiusKm)
  const yr = yearScore(yearDiff, yearRange)
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
