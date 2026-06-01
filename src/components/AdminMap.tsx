import { useEffect, useRef } from 'react'
import L from 'leaflet'

// Fix Leaflet marker ikonek pro Vite
// (Vite nezpracovává default Leaflet icon URLs správně)
const accentIcon = L.divIcon({
  className: '',
  html: `<svg width="26" height="34" viewBox="0 0 22 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11 27s9-9 9-16a9 9 0 1 0-18 0c0 7 9 16 9 16Z" fill="#d97757" stroke="#b85a3e" stroke-width="1"/>
    <circle cx="11" cy="11" r="3.2" fill="#fff"/>
  </svg>`,
  iconSize: [26, 34],
  iconAnchor: [13, 34],
  popupAnchor: [0, -34],
})

interface AdminMapProps {
  lat: number
  lng: number
  radiusKm: number
  onLocationChange: (lat: number, lng: number) => void
}

export default function AdminMap({ lat, lng, radiusKm, onLocationChange }: AdminMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 4,
    })

    // OpenStreetMap tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map)
    map.attributionControl?.setPrefix(false)

    // Marker s vlastní ikonou
    const marker = L.marker([lat, lng], { icon: accentIcon, draggable: true }).addTo(map)

    marker.on('dragend', () => {
      const pos = marker.getLatLng()
      onLocationChange(pos.lat, pos.lng)
    })

    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng)
      onLocationChange(e.latlng.lat, e.latlng.lng)
    })

    markerRef.current = marker
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
      circleRef.current = null
    }
  }, [])

  // Sync marker při ručním zadání souřadnic
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return
    const cur = markerRef.current.getLatLng()
    if (Math.abs(cur.lat - lat) > 0.0001 || Math.abs(cur.lng - lng) > 0.0001) {
      markerRef.current.setLatLng([lat, lng])
      mapRef.current.setView([lat, lng], mapRef.current.getZoom())
    }
  }, [lat, lng])

  // Kružnice radiusu
  useEffect(() => {
    if (!mapRef.current) return
    if (circleRef.current) {
      circleRef.current.remove()
      circleRef.current = null
    }
    if (radiusKm > 0) {
      circleRef.current = L.circle([lat, lng], {
        radius: radiusKm * 1000,
        color: '#d97757',
        fillColor: '#d97757',
        fillOpacity: 0.1,
        weight: 2,
        dashArray: '6 4',
      }).addTo(mapRef.current)
      mapRef.current.fitBounds(circleRef.current.getBounds(), { padding: [20, 20] })
    }
  }, [radiusKm, lat, lng])

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: 340,
          borderRadius: 10,
          border: '1px solid var(--line)',
          overflow: 'hidden',
        }}
      />
      <div style={{
        position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em',
        color: 'var(--ink-3)', background: 'rgba(245,241,232,0.92)',
        padding: '3px 12px', borderRadius: 999, pointerEvents: 'none', zIndex: 1000,
      }}>
        KLIKNI NA MAPU · NEBO TÁHNI PIN
      </div>
    </div>
  )
}
