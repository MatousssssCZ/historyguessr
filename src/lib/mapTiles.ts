import type { Feature } from 'geojson'
import { setWorkerUrl, type Map as MLMap } from 'maplibre-gl'

// MapLibre worker: přesměruj na náš zkopírovaný soubor pod VLASTNÍM (verzovaným)
// názvem. Výchozí `maplibre-gl-worker.mjs` mohl někomu uvíznout v cache jako rozbitá
// verze (viz build/copy skript); nový název ho obejde — prohlížeč ho stáhne čerstvý.
// Bump verze (mlworker-vN) kdykoli je potřeba znovu prorazit cache.
setWorkerUrl('/assets/mlworker-v1.mjs')

// Zdroj mapy — MapLibre GL styl (vektorové dlaždice).
// Výchozí: OpenFreeMap (zdarma, bez klíče, bez limitů) — styl „liberty".
// Přes ENV lze přepnout na jiný styl.
//   VITE_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/positron
//   (nebo MapTiler: https://api.maptiler.com/maps/basic-v2/style.json?key=KLIC)
const CUSTOM_STYLE = (import.meta.env.VITE_MAP_STYLE_URL as string | undefined)?.trim()
export const MAP_STYLE = CUSTOM_STYLE || 'https://tiles.openfreemap.org/styles/liberty'

export const GUESS_FILL = '#d97757'
export const GUESS_STROKE = '#b85a3e'
export const TRUTH_FILL = '#1f9d57'
export const TRUTH_STROKE = '#157a42'

// Normalizace zeměpisné délky do <-180, 180> (starší tipy „o mapu vedle").
export function wrapLng(lng: number): number {
  return ((lng + 180) % 360 + 360) % 360 - 180
}

// SVG pin jako HTML element pro maplibregl.Marker (anchor „bottom" = hrot na souřadnici).
export function makePinElement(fill: string, stroke: string, label?: string): HTMLDivElement {
  const el = document.createElement('div')
  el.style.position = 'relative'
  el.style.width = '26px'
  el.style.height = '34px'
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 22 28" style="display:block">
    <path d="M11 27s9-9 9-16a9 9 0 1 0-18 0c0 7 9 16 9 16Z" fill="${fill}" stroke="${stroke}" stroke-width="1"/>
    <circle cx="11" cy="11" r="3.2" fill="#fff"/>
  </svg>`
  if (label) {
    const s = document.createElement('span')
    s.textContent = label
    s.style.cssText = 'position:absolute;left:28px;top:0;white-space:nowrap;background:rgba(42,31,23,.82);color:#fff;padding:2px 8px;border-radius:7px;font-family:var(--font-sans),sans-serif;font-weight:600;font-size:11px;box-shadow:0 2px 8px -2px rgba(0,0,0,.4)'
    el.appendChild(s)
  }
  return el
}

// GeoJSON kruh (polygon) o poloměru v km — MapLibre nemá kruh v metrech.
export function circlePolygon(lat: number, lng: number, radiusKm: number, steps = 72): Feature {
  const coords: [number, number][] = []
  const R = 6371 // km
  const lat1 = (lat * Math.PI) / 180
  const lng1 = (lng * Math.PI) / 180
  const d = radiusKm / R
  for (let i = 0; i <= steps; i++) {
    const brng = (i / steps) * 2 * Math.PI
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng))
    const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
    coords.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI])
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } }
}

// Vytvoří mapu až když má kontejner reálnou velikost (ResizeObserver). Vrací cleanup.
// Řeší: pre-layout 2px šířku (jinak by maxBounds/transform math spadla) i React
// StrictMode (async RO se stihne odpojit v cleanupu prvního mountu → mapa 1×).
export function createMapWhenSized(
  el: HTMLElement,
  make: (el: HTMLElement) => MLMap,
  onMap: (map: MLMap) => void,
): () => void {
  let done = false
  let map: MLMap | null = null
  const ro = new ResizeObserver(entries => {
    const r = entries[0]?.contentRect
    if (done || !r || r.width < 1 || r.height < 1) return
    done = true
    map = make(el)
    onMap(map)
  })
  ro.observe(el)
  return () => { ro.disconnect(); try { map?.remove() } catch { /* ignore */ } }
}
