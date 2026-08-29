// Build-time generátor mapy událostí do stránky „Objevuj" — STAROBYLÝ / PERGAMENOVÝ styl,
// ať sedí do teplého paper/sepia designu (historická hra). Vše se počítá při buildu;
// do klienta jde jen hotové inline SVG (žádná knihovna).
//
// Postup:
//  1) načte nízko-rozlišný world atlas (topojson → geojson),
//  2) přiřadí každou událost (lat/lng) k zemi přes d3.geoContains (point-in-polygon),
//  3) obarví země v sepiovo-oranžové škále podle počtu událostí (víc = sytější),
//  4) dokreslí ryté pobřeží, jemné poledníky, kompasovou růžici a neatline rámeček.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { geoEqualEarth, geoPath, geoContains, geoGraticule10, geoCentroid } from 'd3-geo'
import { feature } from 'topojson-client'

const require = createRequire(import.meta.url)

// Pergamenová paleta (sladěná s explore.css tokeny).
const OCEAN = '#ece1c9'       // podklad (pergamen)
const LAND0 = '#ddc9a1'       // země bez událostí (tlumený tan)
const COAST = '#7c5a30'       // ryté pobřeží (sepia)
const GRID = '#7c5a30'        // poledníky
const DOT = '#7a2f13'         // tečky u zemí s obsahem (temná terakota)

// Sepiovo-oranžová škála hustoty (víc událostí = sytější a teplejší).
function fillFor(n) {
  if (n <= 0) return LAND0
  if (n === 1) return '#d7a86e'
  if (n <= 3) return '#cb8a4a'
  if (n <= 6) return '#bd6c33'
  if (n <= 10) return '#a8501f'
  return '#8c3a16'
}

/**
 * @param {Array<{lat:number,lng:number}>} events  publikované události s lat/lng
 * @returns {{ svg:string, stats:{countries:number} }}
 */
export function renderWorldMap(events) {
  const topoPath = require.resolve('world-atlas/countries-110m.json')
  const topo = JSON.parse(readFileSync(topoPath, 'utf8'))
  const countries = feature(topo, topo.objects.countries).features

  // Počet událostí v každé zemi (point-in-polygon).
  const counts = new Map()
  for (const ev of events) {
    if (ev.lat == null || ev.lng == null) continue
    const pt = [Number(ev.lng), Number(ev.lat)]
    for (const c of countries) {
      if (geoContains(c, pt)) { counts.set(c.id, (counts.get(c.id) || 0) + 1); break }
    }
  }

  const W = 1000, H = 500, PAD = 26
  const projection = geoEqualEarth().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], { type: 'Sphere' })
  const path = geoPath(projection)
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  // Země — ryté pobřeží + data pro tooltip; <title> jako no-JS fallback.
  const land = countries.map((c) => {
    const n = counts.get(c.id) || 0
    const d = path(c)
    if (!d) return ''
    const name = esc(c.properties?.name || '')
    return `<path d="${d}" fill="${fillFor(n)}" stroke="${COAST}" stroke-width="0.4" stroke-opacity="0.7" data-name="${name}" data-n="${n}"><title>${name}: ${n}</title></path>`
  }).join('')

  // Tečky u zemí s obsahem (na těžišti země) — kartografický detail.
  const dots = countries.map((c) => {
    const n = counts.get(c.id) || 0
    if (n <= 0) return ''
    const p = projection(geoCentroid(c))
    if (!p || Number.isNaN(p[0]) || Number.isNaN(p[1])) return ''
    return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.7" fill="${DOT}" fill-opacity="0.8"/>`
  }).join('')

  const graticule = path(geoGraticule10())
  const sphere = path({ type: 'Sphere' })

  // Kompasová růžice (starobylá, sepia + zlatá).
  const compass = `<g transform="translate(58 ${H - 60})" opacity="0.85" aria-hidden="true">
    <circle r="21" fill="none" stroke="${COAST}" stroke-width="0.8" stroke-opacity="0.6"/>
    <circle r="15" fill="none" stroke="${COAST}" stroke-width="0.5" stroke-opacity="0.4"/>
    <path d="M0 -20 L4.5 0 L0 20 L-4.5 0 Z" fill="${COAST}" fill-opacity="0.85"/>
    <path d="M-20 0 L0 4.5 L20 0 L0 -4.5 Z" fill="#c9a45e"/>
    <path d="M0 -20 L4.5 0 L0 0 Z" fill="#5f4423"/>
    <text x="0" y="-24" text-anchor="middle" fill="${COAST}" font-size="10" font-family="Georgia, serif" font-style="italic">N</text>
  </g>`

  const svg = `<svg class="xp-map-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mapa událostí ve světě" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="xp-vign" cx="50%" cy="46%" r="72%">
      <stop offset="0%" stop-color="#f2e9d5"/>
      <stop offset="70%" stop-color="${OCEAN}"/>
      <stop offset="100%" stop-color="#e2d3b2"/>
    </radialGradient>
    <filter id="xp-paper" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.31  0 0 0 0 0.16  0 0 0 0.05 0"/>
    </filter>
    <clipPath id="xp-map-clip"><path d="${sphere}"/></clipPath>
  </defs>
  <g clip-path="url(#xp-map-clip)">
    <path d="${sphere}" fill="url(#xp-vign)"/>
    <path d="${graticule}" fill="none" stroke="${GRID}" stroke-opacity="0.16" stroke-width="0.5"/>
    ${land}
    ${dots}
    <rect x="0" y="0" width="${W}" height="${H}" filter="url(#xp-paper)"/>
  </g>
  <path d="${sphere}" fill="none" stroke="${COAST}" stroke-opacity="0.55" stroke-width="1"/>
  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="10" fill="none" stroke="${COAST}" stroke-opacity="0.5" stroke-width="1.4"/>
  <rect x="11" y="11" width="${W - 22}" height="${H - 22}" rx="7" fill="none" stroke="${COAST}" stroke-opacity="0.3" stroke-width="0.6"/>
  ${compass}
</svg>`

  return { svg, stats: { countries: counts.size } }
}
