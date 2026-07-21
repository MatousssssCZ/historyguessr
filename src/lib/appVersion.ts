// Detekce nové nasazené verze.
//
// Vite dává bundlu hash v názvu (/assets/index-XXXX.js). Když vyjde nový deploy,
// index.html začne odkazovat na jiný hash. Stačí tedy stáhnout aktuální HTML
// (bez cache) a porovnat. Řeší situaci, kdy uživateli visí starý tab v Safari
// a stránka se z paměti obnoví, aniž by se zeptala serveru.

const BUNDLE_RE = /\/assets\/index-[A-Za-z0-9_-]+\.js/

/** Cesta k bundlu, který právě běží. `null` v devu (tam se běží ze /src). */
function runningBundle(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')
  if (!el) return null
  try { return new URL(el.src, window.location.href).pathname } catch { return null }
}

const CURRENT = typeof document !== 'undefined' ? runningBundle() : null

/** true = na serveru je novější build, než jaký běží v prohlížeči. */
export async function hasNewVersion(): Promise<boolean> {
  if (!CURRENT) return false
  try {
    const res = await fetch(`/?v=${Date.now()}`, { cache: 'no-store', headers: { accept: 'text/html' } })
    if (!res.ok) return false
    const html = await res.text()
    const found = html.match(BUNDLE_RE)?.[0]
    return !!found && found !== CURRENT
  } catch {
    return false // offline / chyba sítě → neotravuj
  }
}
