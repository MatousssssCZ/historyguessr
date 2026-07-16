// Pravidla pro přezdívku — sdílená validace (nastavení i účet).
export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

// Povolené znaky: písmena (vč. diakritiky), číslice, mezera, _ . -
// Zakázané: emoji a jiné speciální znaky.
const ALLOWED = /^[\p{L}\p{N} _.-]+$/u

export type UsernameError = 'tooShort' | 'tooLong' | 'invalid'

export function validateUsername(raw: string): { ok: boolean; value: string; error?: UsernameError } {
  // ořež okraje a sraz vícenásobné mezery na jednu
  const value = raw.trim().replace(/\s+/g, ' ')
  if (value.length < USERNAME_MIN) return { ok: false, value, error: 'tooShort' }
  if (value.length > USERNAME_MAX) return { ok: false, value, error: 'tooLong' }
  if (!ALLOWED.test(value)) return { ok: false, value, error: 'invalid' }
  return { ok: true, value }
}
