// Single Player scénáře — pravidla výběru, ne pevný seznam událostí.
//
// Proč pravidla: scénář má zůstat živý i když přibude obsah. Pevný seznam by
// zestárl. Výjimkou je `exactEventIds` — tam si hráč události zvolil VÝSLOVNĚ,
// takže je respektujeme (a při spuštění ověříme, že jsou pořád dostupné).

export interface PresetRules {
  rounds: number
  categories: string[]
  yearFrom: number
  yearTo: number
  /** Vyloučené události (Free omezeně, Premium neomezeně) */
  excludeIds: string[]
  /** Premium: hraj přesně tyhle události (má přednost před filtry) */
  exactEventIds?: string[]
  /** Premium: jen dosud nehrané */
  onlyUnplayed?: boolean
  /** Premium: jen dříve chybně určené */
  onlyMistakes?: boolean
}

export interface SinglePlayerPreset {
  id: string
  user_id: string
  name: string
  rules: PresetRules
  is_shared: boolean
  share_slug: string | null
  created_at: string
  updated_at: string
}

export interface SharedPreset {
  id: string
  name: string
  rules: PresetRules
  owner_name: string | null
}

export const DEFAULT_RULES: PresetRules = {
  rounds: 5,
  categories: [],
  yearFrom: -3000,
  yearTo: 2025,
  excludeIds: [],
}

/** Bezpečné načtení pravidel z DB (jsonb může být cokoli). */
export function normalizeRules(raw: unknown): PresetRules {
  const r = (raw ?? {}) as Partial<PresetRules>
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : [])
  return {
    rounds: Math.max(1, Math.min(20, num(r.rounds, DEFAULT_RULES.rounds))),
    categories: arr(r.categories),
    yearFrom: num(r.yearFrom, DEFAULT_RULES.yearFrom),
    yearTo: num(r.yearTo, DEFAULT_RULES.yearTo),
    excludeIds: arr(r.excludeIds),
    exactEventIds: arr(r.exactEventIds),
    onlyUnplayed: !!r.onlyUnplayed,
    onlyMistakes: !!r.onlyMistakes,
  }
}

export interface PresetValidation {
  ok: boolean
  /** Kolik událostí pravidlům vyhovuje */
  available: number
  needed: number
  /** Srozumitelné hlášky pro hráče (scénář zestárl, obsah zmizel…) */
  warnings: string[]
  /** Pravidla po bezpečné úpravě (např. bez zmizelých událostí) */
  adjusted: PresetRules
}

/**
 * Ověří scénář proti aktuálně dostupným událostem a bezpečně ho upraví.
 * `availableIds` = ID událostí, které vyhovují filtrům a jsou publikované.
 */
export function validatePreset(rules: PresetRules, availableIds: string[]): PresetValidation {
  const warnings: string[] = []
  const pool = new Set(availableIds)
  const adjusted: PresetRules = { ...rules }

  // Konkrétní události: zahoď ty, které mezitím zmizely
  if (rules.exactEventIds?.length) {
    const alive = rules.exactEventIds.filter(id => pool.has(id))
    const lost = rules.exactEventIds.length - alive.length
    if (lost > 0) {
      warnings.push(`${lost} vybraná událost(í) už není dostupná — scénář ji vynechá.`)
      adjusted.exactEventIds = alive
    }
    const available = alive.length
    if (available < rules.rounds) {
      warnings.push(`Scénář má ${available} z ${rules.rounds} potřebných událostí.`)
      adjusted.rounds = Math.max(1, available)
    }
    return { ok: available >= 1, available, needed: rules.rounds, warnings, adjusted }
  }

  // Vyloučení, která už nedávají smysl, tiše zahoď (nejsou chyba)
  adjusted.excludeIds = rules.excludeIds.filter(id => pool.has(id))

  const available = availableIds.filter(id => !new Set(adjusted.excludeIds).has(id)).length
  if (available < rules.rounds) {
    warnings.push(`Pravidlům vyhovuje jen ${available} událostí, scénář jich chce ${rules.rounds}.`)
    adjusted.rounds = Math.max(1, Math.min(rules.rounds, available))
  }
  return { ok: available >= 1, available, needed: rules.rounds, warnings, adjusted }
}
