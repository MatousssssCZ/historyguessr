// Preload obrázku do cache prohlížeče, ať je panorama připravené dřív,
// než ho Pannellum vyžádá. Idempotentní — každou URL natáhne max jednou.
import { encodePanoramaUrl } from './panorama'

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
