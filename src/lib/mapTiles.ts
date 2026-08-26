// Zdroj mapových dlaždic — konfigurovatelný přes ENV.
//
// CARTO od 2025 u svých basemap dlaždic bez API klíče vykresluje vodoznak
// „API KEY REQUIRED". Proto:
//  - když je nastavena VITE_MAP_TILE_URL, použije se ta (vlož si sem URL šablonu
//    od CARTO / MapTiler / Stadia včetně klíče — čistý vzhled),
//  - jinak fallback na OpenStreetMap (bez klíče, funguje hned, bez vodoznaku).
//
// Šablona musí obsahovat {z}/{x}/{y}; volitelně {s} (subdoména) a {r} (retina @2x).
// Příklady:
//   MapTiler:  https://api.maptiler.com/maps/basic-v2/{z}/{x}/{y}.png?key=TVUJ_KLIC
//   CARTO:     https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?api_key=TVUJ_KLIC
//   Stadia:    https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=TVUJ_KLIC

const CUSTOM_URL = (import.meta.env.VITE_MAP_TILE_URL as string | undefined)?.trim()
const CUSTOM_ATTR = (import.meta.env.VITE_MAP_ATTRIBUTION as string | undefined)?.trim()

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> přispěvatelé'

// Plná verze (retina, když šablona umí {r}); prostá bez {r} pro mini náhledy.
export const TILE_URL = CUSTOM_URL || OSM_URL
export const TILE_URL_PLAIN = (CUSTOM_URL || OSM_URL).replace('{r}', '')
export const TILE_ATTR = CUSTOM_URL ? (CUSTOM_ATTR || '') : OSM_ATTR
