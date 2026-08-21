// URL-safe slug z libovolného názvu (CZ/EN/DE). Diakritika → ASCII,
// mezery a interpunkce → pomlčky. Sdíleno appkou i build-time SSG generátorem.

/** Přepis českých/německých znaků, které `NFD`-normalizace sama neřeší. */
const SPECIAL: Record<string, string> = {
  ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', đ: 'd', ð: 'd', þ: 'th', ł: 'l',
}

export function slugify(input: string): string {
  return (input || '')
    .toLowerCase()
    .replace(/[ßæœøđðþł]/g, (ch) => SPECIAL[ch] || ch)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // odstraň diakritická znaménka (combining marks)
    .replace(/[^a-z0-9]+/g, '-') // vše ostatní → pomlčka
    .replace(/^-+|-+$/g, '') // ořízni pomlčky na krajích
    .replace(/-{2,}/g, '-') // vícenásobné pomlčky → jedna
    .slice(0, 80) // rozumná délka URL segmentu
    .replace(/-+$/g, '')
}

/**
 * Zajistí unikátnost slugu v rámci množiny už použitých slugů.
 * Kolizi řeší příponou `-2`, `-3`, … a použitý slug do množiny přidá.
 */
export function uniqueSlug(base: string, used: Set<string>, fallback = 'udalost'): string {
  const slug = slugify(base) || fallback
  if (!used.has(slug)) { used.add(slug); return slug }
  for (let n = 2; n < 1000; n++) {
    const candidate = `${slug}-${n}`
    if (!used.has(candidate)) { used.add(candidate); return candidate }
  }
  // extrémně nepravděpodobné — přidej náhodný sufix
  const rnd = `${slug}-${Math.random().toString(36).slice(2, 7)}`
  used.add(rnd)
  return rnd
}
