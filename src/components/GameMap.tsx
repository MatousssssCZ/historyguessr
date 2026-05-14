import { useEffect, useRef } from 'react'
import L from 'leaflet'

const guessIcon = L.divIcon({
  className: '',
  html: `<svg width="26" height="34" viewBox="0 0 22 28" fill="none">
    <path d="M11 27s9-9 9-16a9 9 0 1 0-18 0c0 7 9 16 9 16Z" fill="#d97757" stroke="#b85a3e" stroke-width="1"/>
    <circle cx="11" cy="11" r="3.2" fill="#fff"/>
  </svg>`,
  iconSize: [26, 34], iconAnchor: [13, 34], popupAnchor: [0, -34],
})

const truthIcon = L.divIcon({
  className: '',
  html: `<svg width="26" height="34" viewBox="0 0 22 28" fill="none">
    <path d="M11 27s9-9 9-16a9 9 0 1 0-18 0c0 7 9 16 9 16Z" fill="#2a1f17" stroke="#000" stroke-width="1"/>
    <circle cx="11" cy="11" r="3.2" fill="#f5f1e8"/>
  </svg>`,
  iconSize: [26, 34], iconAnchor: [13, 34], popupAnchor: [0, -34],
})

const CARTO = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'

function initMap(container: HTMLDivElement, options: L.MapOptions): L.Map {
  const map = L.map(container, { ...options, preferCanvas: true })
  L.tileLayer(CARTO, { attribution: ATTR, maxZoom: 19 }).addTo(map)

  // ResizeObserver — invalidateSize kdykoliv se změní velikost kontejneru
  const ro = new ResizeObserver(() => map.invalidateSize())
  ro.observe(container)
  ;(map as any)._ro = ro

  return map
}

// ── Herní mapa pro tipování ───────────────────────────────
interface GuessMapProps {
  onGuess: (lat: number, lng: number) => void
  guessLat: number | null
  guessLng: number | null
}

export function GuessMap({ onGuess, guessLat, guessLng }: GuessMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onGuessRef = useRef(onGuess)
  onGuessRef.current = onGuess

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    const map = initMap(container, { center: [20, 0], zoom: 2, minZoom: 1, maxZoom: 12 })

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (markerRef.current) {
        markerRef.current.setLatLng(e.latlng)
      } else {
        markerRef.current = L.marker(e.latlng, { icon: guessIcon, draggable: true }).addTo(map)
        markerRef.current.on('dragend', () => {
          const pos = markerRef.current!.getLatLng()
          onGuessRef.current(pos.lat, pos.lng)
        })
      }
      onGuessRef.current(e.latlng.lat, e.latlng.lng)
    })

    mapRef.current = map

    return () => {
      ;(map as any)._ro?.disconnect()
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: 240, borderRadius: 10, border: '1px solid var(--line)' }}
      />
      {guessLat === null && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
          color: 'var(--ink-3)', background: 'rgba(245,241,232,0.55)',
          borderRadius: 10, pointerEvents: 'none',
        }}>
          KLIKNI PRO UMÍSTĚNÍ PINU
        </div>
      )}
    </div>
  )
}

// ── Výsledková mapa ───────────────────────────────────────
interface ResultMapProps {
  guessLat: number
  guessLng: number
  truthLat: number
  truthLng: number
  radiusKm?: number
}

export function ResultMap({ guessLat, guessLng, truthLat, truthLng, radiusKm = 0 }: ResultMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    const map = initMap(container, {})

    L.marker([guessLat, guessLng], { icon: guessIcon })
      .addTo(map)
      .bindTooltip('Tvůj tip', { permanent: true, direction: 'top', offset: [0, -34] })

    L.marker([truthLat, truthLng], { icon: truthIcon })
      .addTo(map)
      .bindTooltip('Správné místo', { permanent: true, direction: 'top', offset: [0, -34] })

    L.polyline([[guessLat, guessLng], [truthLat, truthLng]], {
      color: '#d97757', weight: 2, dashArray: '6 4', opacity: 0.8,
    }).addTo(map)

    if (radiusKm > 0) {
      L.circle([truthLat, truthLng], {
        radius: radiusKm * 1000,
        color: '#2a1f17', fillColor: '#2a1f17',
        fillOpacity: 0.06, weight: 1.5, dashArray: '4 4',
      }).addTo(map)
    }

    const bounds = L.latLngBounds([guessLat, guessLng], [truthLat, truthLng])
    map.fitBounds(bounds, { padding: [60, 60] })

    mapRef.current = map

    return () => {
      ;(map as any)._ro?.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: 260, borderRadius: 10, border: '1px solid var(--line)' }}
    />
  )
}
