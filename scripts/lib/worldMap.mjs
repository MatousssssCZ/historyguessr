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

// ISO 3166-1 numeric → alpha-2 (world-atlas používá numeric id; klientský
// Intl.DisplayNames potřebuje alpha-2 pro lokalizaci názvu země). Chybějící /
// sporné (id "-99") spadnou na anglický název z atlasu.
const NUM2A2 = {
  '004':'AF','008':'AL','012':'DZ','024':'AO','032':'AR','036':'AU','040':'AT','031':'AZ',
  '044':'BS','050':'BD','051':'AM','052':'BB','056':'BE','060':'BM','064':'BT','068':'BO',
  '070':'BA','072':'BW','076':'BR','084':'BZ','090':'SB','096':'BN','100':'BG','104':'MM',
  '108':'BI','112':'BY','116':'KH','120':'CM','124':'CA','140':'CF','144':'LK','148':'TD',
  '152':'CL','156':'CN','158':'TW','170':'CO','174':'KM','178':'CG','180':'CD','188':'CR',
  '191':'HR','192':'CU','196':'CY','203':'CZ','204':'BJ','208':'DK','214':'DO','218':'EC',
  '222':'SV','226':'GQ','231':'ET','232':'ER','233':'EE','238':'FK','242':'FJ','246':'FI',
  '250':'FR','260':'TF','262':'DJ','266':'GA','268':'GE','270':'GM','275':'PS','276':'DE',
  '288':'GH','300':'GR','304':'GL','308':'GD','320':'GT','324':'GN','328':'GY','332':'HT',
  '340':'HN','344':'HK','348':'HU','352':'IS','356':'IN','360':'ID','364':'IR','368':'IQ',
  '372':'IE','376':'IL','380':'IT','384':'CI','388':'JM','392':'JP','398':'KZ','400':'JO',
  '404':'KE','408':'KP','410':'KR','414':'KW','417':'KG','418':'LA','422':'LB','426':'LS',
  '428':'LV','430':'LR','434':'LY','440':'LT','442':'LU','450':'MG','454':'MW','458':'MY',
  '466':'ML','470':'MT','478':'MR','480':'MU','484':'MX','496':'MN','498':'MD','499':'ME',
  '504':'MA','508':'MZ','512':'OM','516':'NA','524':'NP','528':'NL','540':'NC','548':'VU',
  '554':'NZ','558':'NI','562':'NE','566':'NG','578':'NO','586':'PK','591':'PA','598':'PG',
  '600':'PY','604':'PE','608':'PH','616':'PL','620':'PT','624':'GW','626':'TL','630':'PR',
  '634':'QA','642':'RO','643':'RU','646':'RW','682':'SA','686':'SN','688':'RS','690':'SC',
  '694':'SL','702':'SG','703':'SK','704':'VN','705':'SI','706':'SO','710':'ZA','716':'ZW',
  '724':'ES','728':'SS','729':'SD','740':'SR','748':'SZ','752':'SE','756':'CH','760':'SY',
  '762':'TJ','764':'TH','768':'TG','780':'TT','784':'AE','788':'TN','792':'TR','795':'TM',
  '800':'UG','804':'UA','807':'MK','818':'EG','826':'GB','834':'TZ','840':'US','854':'BF',
  '858':'UY','860':'UZ','862':'VE','887':'YE','894':'ZM',
}

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
    const cc = NUM2A2[String(c.id).padStart(3, '0')] || ''  // alpha-2 pro klientskou lokalizaci
    return `<path d="${d}" fill="${fillFor(n)}" stroke="${COAST}" stroke-width="0.4" stroke-opacity="0.7"${cc ? ` data-cc="${cc}"` : ''} data-name="${name}" data-n="${n}"><title>${name}: ${n}</title></path>`
  }).join('')

  // Tečky u zemí s obsahem (na těžišti země) — kartografický detail.
  const dots = countries.map((c) => {
    const n = counts.get(c.id) || 0
    if (n <= 0) return ''
    const p = projection(geoCentroid(c))
    if (!p || Number.isNaN(p[0]) || Number.isNaN(p[1])) return ''
    return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.7" fill="${DOT}" fill-opacity="0.8" pointer-events="none"/>`
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
    <path d="${sphere}" fill="url(#xp-vign)" pointer-events="none"/>
    <path d="${graticule}" fill="none" stroke="${GRID}" stroke-opacity="0.16" stroke-width="0.5" pointer-events="none"/>
    ${land}
    ${dots}
    <rect x="0" y="0" width="${W}" height="${H}" filter="url(#xp-paper)" pointer-events="none"/>
  </g>
  <path d="${sphere}" fill="none" stroke="${COAST}" stroke-opacity="0.55" stroke-width="1" pointer-events="none"/>
  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="10" fill="none" stroke="${COAST}" stroke-opacity="0.5" stroke-width="1.4" pointer-events="none"/>
  <rect x="11" y="11" width="${W - 22}" height="${H - 22}" rx="7" fill="none" stroke="${COAST}" stroke-opacity="0.3" stroke-width="0.6" pointer-events="none"/>
  ${compass}
</svg>`

  return { svg, stats: { countries: counts.size } }
}
