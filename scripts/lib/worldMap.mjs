// Build-time generátor SVG choropletu událostí do stránky „Objevuj".
// Vše se počítá při buildu — do klienta putuje JEN hotové inline SVG, žádná knihovna.
//
// Postup:
//  1) načte nízko-rozlišný world atlas (topojson → geojson),
//  2) přiřadí každou událost (lat/lng) k zemi přes d3.geoContains (point-in-polygon),
//  3) obarví země podle počtu událostí (tmavá → oranžová) a přidá tečky u zemí s obsahem,
//  4) dokreslí graticule, rámeček a kompas.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { geoEqualEarth, geoPath, geoContains, geoGraticule10, geoCentroid } from 'd3-geo'
import { feature } from 'topojson-client'

const require = createRequire(import.meta.url)

// Barevná škála podle počtu událostí v zemi (brand oranžová na tmavém podkladu).
const EMPTY_FILL = '#241f1c'
function fillFor(n) {
  if (n <= 0) return EMPTY_FILL
  if (n === 1) return '#5a2a19'
  if (n <= 3) return '#8a3a1c'
  if (n <= 6) return '#b8481f'
  if (n <= 10) return '#d95f27'
  return '#f2702f'
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
  const counts = new Map() // id → n
  for (const ev of events) {
    if (ev.lat == null || ev.lng == null) continue
    const pt = [Number(ev.lng), Number(ev.lat)]
    for (const c of countries) {
      if (geoContains(c, pt)) { counts.set(c.id, (counts.get(c.id) || 0) + 1); break }
    }
  }

  const W = 1000, H = 520, PAD = 16
  const projection = geoEqualEarth().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], { type: 'Sphere' })
  const path = geoPath(projection)

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  // Země — s data atributy pro interaktivní tooltip a <title> jako no-JS fallback.
  const land = countries.map((c) => {
    const n = counts.get(c.id) || 0
    const d = path(c)
    if (!d) return ''
    const name = esc(c.properties?.name || '')
    return `<path d="${d}" fill="${fillFor(n)}" stroke="#000" stroke-width="0.35" stroke-opacity="0.55" data-name="${name}" data-n="${n}"><title>${name}: ${n}</title></path>`
  }).join('')

  // Tečky u zemí s obsahem (na těžišti země)
  const dots = countries.map((c) => {
    const n = counts.get(c.id) || 0
    if (n <= 0) return ''
    const p = projection(geoCentroid(c))
    if (!p || Number.isNaN(p[0]) || Number.isNaN(p[1])) return ''
    return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.1" fill="#ff7a33"/>`
  }).join('')

  const graticule = path(geoGraticule10())
  const sphere = path({ type: 'Sphere' })

  const svg = `<svg class="xp-map-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mapa událostí ve světě" preserveAspectRatio="xMidYMid meet">
  <defs>
    <clipPath id="xp-map-clip"><path d="${sphere}"/></clipPath>
  </defs>
  <g clip-path="url(#xp-map-clip)">
    <path d="${sphere}" fill="#141010"/>
    <path d="${graticule}" fill="none" stroke="#ffffff" stroke-opacity="0.05" stroke-width="0.5"/>
    ${land}
    ${dots}
  </g>
  <path d="${sphere}" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="0.8"/>
  <g transform="translate(46 ${H - 46})" opacity="0.6" aria-hidden="true">
    <circle r="15" fill="none" stroke="#d95f27" stroke-width="1"/>
    <path d="M0 -13 L4 0 L0 13 L-4 0 Z" fill="#d95f27"/>
    <text x="0" y="-19" text-anchor="middle" fill="#d95f27" font-size="9" font-family="sans-serif">N</text>
  </g>
</svg>`

  return { svg, stats: { countries: counts.size } }
}
