// Výchozí hfov (horizontální zorné pole) panoramatu.
// Na desktopu širší záběr (méně „přiblížené"), na mobilu užší (126) —
// na výšku by širší hfov působil jako rybí oko a scéna byla moc „daleko".
export function panoramaHfov(): number {
  if (typeof window !== 'undefined' && window.innerWidth >= 900) return 150
  return 126
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
