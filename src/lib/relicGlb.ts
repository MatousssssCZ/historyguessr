// Automatizace tvorby GLB modelů relikvií přes vendorovaný nástroj „3D export karet".
// Nástroj běží v skrytém (off-screen, NE display:none — rAF/setTimeout by se jinak
// uškrtily) iframe ze stejného originu (/relic-tool/), vystaví `window.hgBuildGLB`,
// který pro zadané parametry vrátí binární GLB všech čtyř rarit.

export type Rarity4 = 'common' | 'rare' | 'epic' | 'legendary'

// Slug kategorie relikvie (app) → klíč kategorie v nástroji (určí lem + znak).
const CATEGORY_TO_TOOL: Record<string, string> = {
  war: 'Války',
  moments: 'Historické okamžiky',
  places: 'Objevy míst',
  inventions: 'Vynálezy',
  art: 'Umění',
  sports: 'Sportovní okamžiky',
  mysteries: 'Záhady a legendy',
  disasters: 'Katastrofy',
}

interface HgBuildParams {
  name: string
  year?: string
  category?: string          // klíč nástroje (CATEGORIES), ne slug
  relicImgDataURL?: string
  side?: string
  emblem?: string
  editionTotal?: string | number
}
type HgWindow = Window & { hgBuildGLB?: (p: HgBuildParams) => Promise<Record<Rarity4, Uint8Array>>; __hgReady?: boolean }

const TOOL_URL = '/relic-tool/index.html'
let framePromise: Promise<HgWindow> | null = null

/** Načte (jednou) skrytý iframe s nástrojem a počká, než vystaví hgBuildGLB. */
function getToolWindow(): Promise<HgWindow> {
  if (framePromise) return framePromise
  framePromise = new Promise<HgWindow>((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.src = TOOL_URL
    iframe.setAttribute('aria-hidden', 'true')
    iframe.tabIndex = -1
    // off-screen, ne display:none — WebGL i časovače musí dál tikat
    Object.assign(iframe.style, {
      position: 'fixed', left: '-10000px', top: '0', width: '960px', height: '720px',
      border: '0', opacity: '0', pointerEvents: 'none', zIndex: '-1',
    } as CSSStyleDeclaration)
    const timeout = setTimeout(() => { reject(new Error('Nástroj pro GLB se nenačetl včas.')) }, 30000)
    const tryResolve = () => {
      const w = iframe.contentWindow as HgWindow | null
      if (w && typeof w.hgBuildGLB === 'function') { clearTimeout(timeout); resolve(w) }
    }
    const onMsg = (e: MessageEvent) => {
      if (e.source === iframe.contentWindow && e.data && e.data.type === 'hg-tool-ready') {
        window.removeEventListener('message', onMsg); tryResolve()
      }
    }
    window.addEventListener('message', onMsg)
    iframe.onload = () => {
      // postMessage ready může přijít dřív/později — zkontroluj hned i s krátkým pollem
      let tries = 0
      const poll = setInterval(() => {
        const w = iframe.contentWindow as HgWindow | null
        if ((w && typeof w.hgBuildGLB === 'function') || ++tries > 60) {
          clearInterval(poll); window.removeEventListener('message', onMsg); tryResolve()
          if (tries > 60 && !(w && typeof w.hgBuildGLB === 'function')) reject(new Error('Nástroj pro GLB se neinicializoval.'))
        }
      }, 250)
    }
    document.body.appendChild(iframe)
  })
  return framePromise
}

/** Stáhne obrázek (URL) a převede na data: URL (pro vložení jako grafika relikvie). */
export async function urlToDataURL(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors' })
  const blob = await res.blob()
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('Načtení obrázku relikvie selhalo.'))
    r.readAsDataURL(blob)
  })
}

export interface BuildGlbInput {
  name: string
  year?: string
  categorySlug?: string      // slug z RELIC_CATEGORIES (app)
  relicImgDataURL?: string   // grafika relikvie (data: URL)
  side?: string
  emblem?: string
  editionTotal?: string | number
}

/** Vygeneruje GLB všech čtyř rarit → mapa { common, rare, epic, legendary: File }. */
export async function buildRelicGlbs(input: BuildGlbInput): Promise<Record<Rarity4, File>> {
  const w = await getToolWindow()
  if (!w.hgBuildGLB) throw new Error('Nástroj pro GLB není dostupný.')
  const bytes = await w.hgBuildGLB({
    name: input.name,
    year: input.year,
    category: input.categorySlug ? CATEGORY_TO_TOOL[input.categorySlug] : undefined,
    relicImgDataURL: input.relicImgDataURL,
    side: input.side,
    emblem: input.emblem,
    editionTotal: input.editionTotal,
  })
  const out = {} as Record<Rarity4, File>
  for (const k of ['common', 'rare', 'epic', 'legendary'] as const) {
    const u8 = bytes[k]
    // kopie do čistého ArrayBuffer (data z iframe → vlastní Blob)
    const copy = new Uint8Array(u8.byteLength); copy.set(u8)
    out[k] = new File([copy], `${k}.glb`, { type: 'model/gltf-binary' })
  }
  return out
}
