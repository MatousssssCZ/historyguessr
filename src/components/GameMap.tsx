import { useEffect, useRef } from 'react'
import L from 'leaflet'

// Leaflet tile URL a attributace
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'

// Custom ikony (SVG inline — bez externích PNG souborů)
const makeIcon = (color: string) => L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 22 28">
    <path d="M11 27s9-9 9-16a9 9 0 1 0-18 0c0 7 9 16 9 16Z" fill="${color}" stroke="${color === '#d97757' ? '#b85a3e' : '#000'}" stroke-width="1"/>
    <circle cx="11" cy="11" r="3.2" fill="${color === '#d97757' ? '#fff' : '#f5f1e8'}"/>
  </svg>`,
  iconSize: [26, 34],
  iconAnchor: [13, 34],
  popupAnchor: [0, -34],
})

const GUESS_ICON = makeIcon('#d97757')
const TRUTH_ICON = makeIcon('#2a1f17')

// ─────────────────────────────────────────────────────────
// GuessMap — herní mapa pro tipování
// Klíčový fix: Leaflet se inicializuje SYNCHRONNĚ v useEffect
// ale map pane offset se opravuje přes MutationObserver který
// čeká dokud není kontejner skutečně v DOM s nenulovou výškou
// ─────────────────────────────────────────────────────────
interface GuessMapProps {
  onGuess: (lat: number, lng: number) => void
  guessLat: number | null
  guessLng: number | null
}

export function GuessMap({ onGuess, guessLat, guessLng }: GuessMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onGuessRef = useRef(onGuess)
  onGuessRef.current = onGuess

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || mapRef.current) return

    // Počkej dokud kontejner má nenulovou výšku
    // (pokud je v absolutně pozicovaném elementu, layout může být delayed)
    function initWhenReady() {
      if (!wrap) return
      const h = wrap.offsetHeight
      const w = wrap.offsetWidth
      if (h === 0 || w === 0) {
        // Zkus znovu za 1 frame
        requestAnimationFrame(initWhenReady)
        return
      }

      // Inicializuj mapu
      const map = L.map(wrap, {
        center: [20, 0],
        zoom: 2,
        minZoom: 1,
        maxZoom: 18,
        zoomControl: true,
      })

      L.tileLayer(TILE_URL, {
        attribution: TILE_ATTR,
        maxZoom: 19,
      }).addTo(map)

      // Oprav offset — zavolej invalidateSize IHNED po inicializaci
      // a pak ještě 3x s různými delays
      map.invalidateSize({ animate: false })
      setTimeout(() => { map.invalidateSize({ animate: false }) }, 100)
      setTimeout(() => { map.invalidateSize({ animate: false }) }, 300)
      setTimeout(() => { map.invalidateSize({ animate: false }) }, 600)

      // Click handler
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (markerRef.current) {
          markerRef.current.setLatLng(e.latlng)
        } else {
          const m = L.marker(e.latlng, { icon: GUESS_ICON, draggable: true }).addTo(map)
          m.on('dragend', () => {
            const pos = m.getLatLng()
            onGuessRef.current(pos.lat, pos.lng)
          })
          markerRef.current = m
        }
        onGuessRef.current(e.latlng.lat, e.latlng.lng)
      })

      mapRef.current = map
    }

    // Spusť inicializaci po prvním frame
    requestAnimationFrame(initWhenReady)

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: 220 }}>
      <div
        ref={wrapRef}
        style={{ width: '100%', height: 220 }}
      />
      {guessLat === null && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 1000,
        }}>
          <div style={{
            background: 'rgba(245,241,232,0.9)',
            padding: '6px 14px', borderRadius: 999,
            fontFamily: 'var(--font-mono)', fontSize: 10,
            letterSpacing: '0.14em', color: 'var(--ink-3)',
          }}>
            KLIKNI PRO UMÍSTĚNÍ PINU
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// ResultMap — výsledková mapa (tip vs. správné místo)
// ─────────────────────────────────────────────────────────
interface ResultMapProps {
  guessLat: number
  guessLng: number
  truthLat: number
  truthLng: number
  radiusKm?: number
}

export function ResultMap({ guessLat, guessLng, truthLat, truthLng, radiusKm = 0 }: ResultMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || mapRef.current) return

    function initWhenReady() {
      if (!wrap) return
      if (wrap.offsetHeight === 0 || wrap.offsetWidth === 0) {
        requestAnimationFrame(initWhenReady)
        return
      }

      const map = L.map(wrap)
      L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map)

      // Piny
      L.marker([guessLat, guessLng], { icon: GUESS_ICON })
        .addTo(map)
        .bindTooltip('Tvůj tip', { permanent: true, direction: 'top', offset: [0, -34] })

      L.marker([truthLat, truthLng], { icon: TRUTH_ICON })
        .addTo(map)
        .bindTooltip('Správné místo', { permanent: true, direction: 'top', offset: [0, -34] })

      // Linka
      L.polyline([[guessLat, guessLng], [truthLat, truthLng]], {
        color: '#d97757', weight: 2, dashArray: '6 4', opacity: 0.8,
      }).addTo(map)

      // Radius
      if (radiusKm > 0) {
        L.circle([truthLat, truthLng], {
          radius: radiusKm * 1000,
          color: '#2a1f17', fillColor: '#2a1f17', fillOpacity: 0.06,
          weight: 1.5, dashArray: '4 4',
        }).addTo(map)
      }

      // Fit bounds
      const bounds = L.latLngBounds([guessLat, guessLng], [truthLat, truthLng])
      map.fitBounds(bounds, { padding: [60, 60] })
      map.invalidateSize({ animate: false })
      setTimeout(() => map.invalidateSize({ animate: false }), 100)

      mapRef.current = map
    }

    requestAnimationFrame(initWhenReady)

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  return (
    <div
      ref={wrapRef}
      style={{
        width: '100%', height: 260,
        borderRadius: 10, border: '1px solid var(--line)',
        overflow: 'hidden',
      }}
    />
  )
}
