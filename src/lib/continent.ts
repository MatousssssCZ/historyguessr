// Offline odvození kontinentu z GPS. Žádná externí služba.
//
// Princip: hrubé polygony kontinentů + ray-casting. Vnitrozemí padne do právě
// jednoho polygonu → JISTÉ. U reálných hranic (Ural, Bospor, Suez, Panama,
// Wallaceova linie) se polygony záměrně překrývají nebo bod nepadne nikam →
// NEJISTÉ, a takovou událost má zkontrolovat admin. To je přesně v duchu zadání:
// „jak řešit události na hranicích" + „umožnit administrátorovi opravu".

export const CONTINENTS = [
  'Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania', 'Antarctica',
] as const
export type Continent = typeof CONTINENTS[number]

export interface ContinentResult {
  continent: Continent | null
  /** true = bod padl právě do jednoho polygonu (spolehlivé) */
  confident: boolean
}

type Ring = [number, number][]   // [lng, lat]

// Hrubé polygony. Cíl: pokrýt vnitrozemí, u hranic připustit překryv/mezeru.
const POLYGONS: Record<Continent, Ring[]> = {
  Europe: [[
    [-11, 36], [-11, 44], [-10, 54], [-8, 59], [4, 62], [12, 65], [24, 66], [30, 70],
    [40, 66], [50, 60], [56, 52], [50, 46], [42, 40], [28, 40], [24, 38], [14, 37],
    [-6, 36], [-11, 36],
  ]],
  Asia: [[
    [26, 40], [40, 42], [50, 46], [56, 52], [60, 60], [69, 66], [90, 74], [140, 73],
    [180, 68], [180, 40], [145, 34], [122, 22], [110, 8], [95, 5], [78, 6], [60, 22],
    [43, 12], [35, 28], [26, 33], [26, 40],
  ]],
  Africa: [[
    [-18, 35], [10, 37], [25, 32], [34, 30], [43, 12], [51, 11], [43, -2], [40, -16],
    [35, -24], [20, -35], [15, -30], [12, -16], [8, 4], [-8, 5], [-17, 15], [-18, 35],
  ]],
  'North America': [[
    [-168, 66], [-140, 70], [-95, 72], [-60, 72], [-52, 60], [-65, 45], [-75, 36],
    [-81, 25], [-87, 21], [-95, 16], [-105, 20], [-115, 30], [-125, 40], [-135, 58],
    [-168, 66],
  ]],
  'South America': [[
    [-81, 8], [-70, 12], [-60, 11], [-50, 5], [-34, -7], [-40, -22], [-48, -28],
    [-58, -35], [-65, -45], [-68, -53], [-74, -50], [-76, -40], [-81, -20], [-81, 8],
  ]],
  Oceania: [[
    [112, -10], [130, -11], [142, -10], [154, -20], [154, -34], [147, -44], [130, -32],
    [114, -22], [112, -10],
  ], [  // Nový Zéland
    [166, -47], [179, -47], [179, -34], [172, -34], [166, -47],
  ]],
  Antarctica: [[
    [-180, -60], [180, -60], [180, -90], [-180, -90], [-180, -60],
  ]],
}

/** Ray-casting: je bod uvnitř polygonu? */
function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersect = (yi > lat) !== (yj > lat)
      && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function inContinent(lng: number, lat: number, c: Continent): boolean {
  return POLYGONS[c].some(ring => pointInRing(lng, lat, ring))
}

function wrapLng(lng: number): number {
  return ((lng + 180) % 360 + 360) % 360 - 180
}

/**
 * Odvodí kontinent z GPS. `confident=false` znamená: hranice / mimo pevninu /
 * víc kandidátů → nechat na ruční kontrole (nezobrazovat jako jistý údaj).
 */
export function continentOf(lat: number, lng: number): ContinentResult {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)
    || lat < -90 || lat > 90 || lng < -180 || lng > 180
    || (lat === 0 && lng === 0)) {
    return { continent: null, confident: false }
  }
  const x = wrapLng(lng)

  // Antarktida má přednost (jednoznačné pásmo)
  if (lat < -60) return { continent: 'Antarctica', confident: lat < -63 }

  const hits = CONTINENTS.filter(c => c !== 'Antarctica' && inContinent(x, lat, c))
  if (hits.length === 1) return { continent: hits[0], confident: true }
  if (hits.length > 1) return { continent: hits[0], confident: false }  // překryv u hranice
  return { continent: null, confident: false }                          // oceán / mimo
}
