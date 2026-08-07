// Pravidla pro přezdívku — sdílená validace (nastavení i účet).
// Stejná pravidla vynucuje i DB trigger (migrace username_rules) — klient je
// pro UX, server je autorita (nejde obejít přímým API voláním).
export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

// Povolené znaky: písmena (vč. diakritiky), číslice, mezera, _ . -
// Zakázané: emoji a jiné speciální znaky.
const ALLOWED = /^[\p{L}\p{N} _.-]+$/u

export type UsernameError = 'tooShort' | 'tooLong' | 'invalid' | 'reserved' | 'profane'

// Rezervovaná jména — ochrana proti vydávání se za tým/oficiální účet.
// Porovnává se s normalizovaným (bez diakritiky/oddělovačů) CELÝM jménem.
const RESERVED = new Set([
  'admin', 'administrator', 'administrace', 'moderator', 'mod', 'moderatorka',
  'support', 'podpora', 'system', 'root', 'staff', 'team', 'tym', 'official',
  'historyguesser', 'historyguessr', 'geoguessr', 'owner', 'operator',
  'null', 'undefined', 'anonymous', 'anonym', 'guest', 'host', 'bot',
])

// Jednoznačné vulgarismy/urážky — blokují se jako PODŘETĚZEC normalizovaného
// jména (chytí i „xxfuckxx"). Jen slova, kde je riziko falešné shody nízké.
// Pozn.: položky jsou ASCII (bez diakritiky) — normalizace vstupu diakritiku
// odstraní, takže „piča" i „pica" se porovnávají jako „pica".
const PROFANITY_STRONG = [
  // CZ
  'kurva', 'kurwa', 'pica', 'curak', 'debil', 'kokot', 'kunda',
  'mrdka', 'mrdat', 'jebat', 'vyjeb', 'projeb', 'hovno', 'sracka', 'zmrd', 'zkurv',
  'buzna', 'buzerant', 'chcanky', 'hajzl',
  // EN
  'fuck', 'motherfuck', 'shit', 'bitch', 'cunt', 'asshole', 'nigger', 'nigga',
  'faggot', 'whore', 'pussy', 'wanker', 'retard',
  // DE
  'scheisse', 'arschloch', 'fotze', 'wichser', 'hurensohn', 'schlampe', 'nutte', 'schwuchtel',
  // nenávist / extremismus
  'hitler', 'hakenkreuz',
]

// Kratší / kolizní výrazy — blokují se jen když je jimi CELÉ jméno (po
// normalizaci), aby nezasáhly legitimní jména („Draper", „Ignazio", „Cigánek").
const PROFANITY_EXACT = [
  'prdel', 'prcat', 'rape', 'slut', 'dick', 'nazi', 'heil', 'kkk', 'cigan', 'cikan', 'cygan',
]

// Mapa leetspeak → písmeno, ať projde i „f4ck", „sh1t", „@ss".
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' }

/** Normalizace pro porovnání: malá písmena, bez diakritiky, leet→písmeno,
 *  pryč oddělovače/mezery, 3+ stejné znaky sraž na 2. */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[013457@$]/g, ch => LEET[ch] ?? ch)
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // odstraní diakritiku
    .replace(/[^a-z0-9]/g, '')                        // pryč mezery, oddělovače, emoji
    .replace(/(.)\1{2,}/g, '$1$1')                    // fuuuck → fuuck
}

export function isReserved(raw: string): boolean {
  return RESERVED.has(normalizeForMatch(raw))
}

export function isProfane(raw: string): boolean {
  const n = normalizeForMatch(raw)
  if (PROFANITY_STRONG.some(w => n.includes(w))) return true   // podřetězec
  if (PROFANITY_EXACT.includes(n)) return true                 // jen celé jméno
  return false
}

export function validateUsername(raw: string): { ok: boolean; value: string; error?: UsernameError } {
  // ořež okraje a sraz vícenásobné mezery na jednu
  const value = raw.trim().replace(/\s+/g, ' ')
  if (value.length < USERNAME_MIN) return { ok: false, value, error: 'tooShort' }
  if (value.length > USERNAME_MAX) return { ok: false, value, error: 'tooLong' }
  if (!ALLOWED.test(value)) return { ok: false, value, error: 'invalid' }
  if (isReserved(value)) return { ok: false, value, error: 'reserved' }
  if (isProfane(value)) return { ok: false, value, error: 'profane' }
  return { ok: true, value }
}
