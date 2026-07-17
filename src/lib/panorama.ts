// Výchozí hfov (horizontální zorné pole) panoramatu.
// Na desktopu širší záběr (méně „přiblížené"), na mobilu ponecháváme 140,
// protože na výšku by ještě širší hfov působil jako rybí oko.
export function panoramaHfov(): number {
  if (typeof window !== 'undefined' && window.innerWidth >= 900) return 150
  return 140
}

/**
 * Bezpečně zenkóduje URL panoramatu. Některé starší soubory mají v názvu
 * mezery/speciální znaky (neenkódované) → Pannellum ani fetch je neotevřou.
 * Enkódujeme jednotlivé segmenty cesty; už zenkódované znaky zůstanou (idempotentní).
 */
export function encodePanoramaUrl(url: string | null | undefined): string {
  if (!url || url === 'pending') return url ?? ''
  try {
    const u = new URL(url)
    u.pathname = u.pathname
      .split('/')
      .map(seg => {
        try { return encodeURIComponent(decodeURIComponent(seg)) }
        catch { return encodeURIComponent(seg) }
      })
      .join('/')
    return u.toString()
  } catch {
    return url
  }
}
