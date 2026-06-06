// Preload obrázku do cache prohlížeče, ať je panorama připravené dřív,
// než ho Pannellum vyžádá. Idempotentní — každou URL natáhne max jednou.
const preloaded = new Set<string>()

export function preloadImage(url?: string | null) {
  if (!url || url === 'pending' || preloaded.has(url)) return
  preloaded.add(url)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
}
