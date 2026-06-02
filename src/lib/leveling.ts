// Leveling systém — WoW-inspirovaná křivka (mírný růst, velká absolutní čísla)
// xpDoDalšího(L) = round(BASE * L^EXP). Laditelné dvěma konstantami.

const BASE = 2500
const EXP = 1.4

/** Kolik XP je potřeba na postup z levelu L na L+1 */
export function xpToNext(level: number): number {
  return Math.round(BASE * Math.pow(level, EXP))
}

export interface LevelInfo {
  level: number
  into: number    // XP nasbírané v aktuálním levelu
  need: number    // XP potřebné pro postup z aktuálního levelu
  pct: number     // 0..1 progres v aktuálním levelu
}

/** Z celkového XP spočítá level + progres do dalšího */
export function levelFromXp(xp: number): LevelInfo {
  let level = 1
  let remaining = Math.max(0, Math.floor(xp || 0))
  // pojistka proti nekonečné smyčce
  while (level < 999 && remaining >= xpToNext(level)) {
    remaining -= xpToNext(level)
    level++
  }
  const need = xpToNext(level)
  return { level, into: remaining, need, pct: need > 0 ? Math.min(1, remaining / need) : 0 }
}

// Bonusy za dohrané aktivity (mimo samotné body)
export const XP_BONUS_GAME = 500   // dohraná sólo hra
export const XP_BONUS_DAILY = 300  // denní výzva
