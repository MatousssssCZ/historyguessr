const MAX_SCORE = 5_000

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
  return Math.max(0, MAX_SCORE - Math.round(over))
}

export function yearScore(guessYear: number, yearFrom: number, yearTo: number): number {
  if (guessYear >= yearFrom && guessYear <= yearTo) return MAX_SCORE
  const over = guessYear < yearFrom ? yearFrom - guessYear : guessYear - yearTo
  return Math.max(0, MAX_SCORE - over)
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
  return `${Math.round(km).toLocaleString('cs-CZ')} km`
}

export function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} př. n. l.`
  return `${year} n. l.`
}

export function scorePercent(score: number, maxScore = 10_000): number {
  return Math.round((score / maxScore) * 100)
}
