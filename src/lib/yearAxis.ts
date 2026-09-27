// Osa roku pro „guess" slider. Po částech lineární: úsek př. n. l. (MIN..0)
// dostane jen BC_SHARE šířky, n. l. (0..MAX) zbytek — událostí př. n. l. je málo.
// Sdíleno mezi sólo hrou, denní výzvou i multiplayerem, ať se nerozjede.
export const YEAR_MIN = -3000
export const YEAR_MAX = 2025
export const BC_SHARE = 0.33            // podíl šířky pro př. n. l.
export const ZERO_PCT = BC_SHARE * 100  // pozice roku 0 na liště (%)

/** Rok → pozice na liště 0..1. */
export function yearToPos(y: number): number {
  return y <= 0
    ? BC_SHARE * (y - YEAR_MIN) / (0 - YEAR_MIN)
    : BC_SHARE + (1 - BC_SHARE) * (y / YEAR_MAX)
}

/** Pozice 0..1 → rok (celé číslo). */
export function posToYear(p: number): number {
  return p <= BC_SHARE
    ? Math.round(YEAR_MIN + (p / BC_SHARE) * (0 - YEAR_MIN))
    : Math.round(((p - BC_SHARE) / (1 - BC_SHARE)) * YEAR_MAX)
}

export const clampYear = (y: number) => Math.max(YEAR_MIN, Math.min(YEAR_MAX, y))
