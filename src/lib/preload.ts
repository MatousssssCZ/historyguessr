// Preload obrázku do cache prohlížeče, ať je panorama připravené dřív,
// než ho Pannellum vyžádá. Idempotentní — každou URL natáhne max jednou.
import { encodePanoramaUrl } from './panorama'
import { getEventImages, transformedImageUrl } from './supabase'

const preloaded = new Set<string>()

export function preloadImage(url?: string | null) {
  if (!url || url === 'pending') return
  const enc = encodePanoramaUrl(url)
  if (preloaded.has(enc)) return
  preloaded.add(enc)
  const img = new Image()
  img.decoding = 'async'
  img.src = enc
}

// ── Hero obrázky domovského menu ────────────────────────────────────────────
// Sdílené mezi menu a přednačtením (Auth/App), ať je panorama menu připravené
// dřív, než se do menu vejde. URL se cachují v sessionStorage, snímky v cache
// prohlížeče.
const HERO_KEY = 'heroImgs'
const heroTransform = (urls: string[]) => urls.map(u => transformedImageUrl(u, { width: 1400, quality: 60 }))

/** Vrátí (a nacachuje) transformované URL hero obrázků menu. */
export async function getMenuHeroImages(): Promise<string[]> {
  try {
    const cached = sessionStorage.getItem(HERO_KEY)
    if (cached) {
      const u = JSON.parse(cached) as string[]
      if (Array.isArray(u) && u.length) return heroTransform(u)
    }
  } catch { /* ignore */ }
  const imgs = await getEventImages()
  if (!imgs.length) return []
  const pool = [...imgs]
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]] }
  const chosen = pool.slice(0, 5)
  try { sessionStorage.setItem(HERO_KEY, JSON.stringify(chosen)) } catch { /* ignore */ }
  return heroTransform(chosen)
}

/** Přednačte hero obrázky menu (URL + první snímky do cache prohlížeče). Idempotentní. */
let heroPrefetched = false
export function prefetchMenuHero() {
  if (heroPrefetched) return
  heroPrefetched = true
  getMenuHeroImages().then(urls => {
    urls.slice(0, 2).forEach((u, i) => {
      const img = new Image()
      img.decoding = 'async'
      try { (img as unknown as { fetchPriority?: string }).fetchPriority = i === 0 ? 'high' : 'low' } catch { /* ignore */ }
      img.src = u
    })
  }).catch(() => {})
}
