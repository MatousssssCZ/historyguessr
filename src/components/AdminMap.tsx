import { useEffect, useRef } from 'react'
import { Map as MLMap, Marker, GeoJSONSource } from 'maplibre-gl'
import type { Feature } from 'geojson'
import { MAP_STYLE, GUESS_FILL, GUESS_STROKE, makePinElement, circlePolygon, createMapWhenSized } from '@/lib/mapTiles'

interface AdminMapProps {
  lat: number
  lng: number
  radiusKm: number
  onLocationChange: (lat: number, lng: number) => void
}

export default function AdminMap({ lat, lng, radiusKm, onLocationChange }: AdminMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const readyRef = useRef(false)
  const cbRef = useRef(onLocationChange)
  cbRef.current = onLocationChange

  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return
    return createMapWhenSized(el,
      (c) => new MLMap({
        container: c, style: MAP_STYLE, center: [lng, lat], zoom: 4,
        renderWorldCopies: false, attributionControl: { compact: true },
        dragRotate: false, pitchWithRotate: false,
      }),
      (map) => {
        mapRef.current = map
        map.on('click', (e) => {
          markerRef.current?.setLngLat(e.lngLat)
          cbRef.current(e.lngLat.lat, e.lngLat.lng)
        })
        map.on('style.load', () => {
          readyRef.current = true
          const marker = new Marker({ element: makePinElement(GUESS_FILL, GUESS_STROKE), anchor: 'bottom', draggable: true })
            .setLngLat([lng, lat]).addTo(map)
          marker.on('dragend', () => { const p = marker.getLngLat(); cbRef.current(p.lat, p.lng) })
          markerRef.current = marker
          applyRadius()
        })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync marker + střed při ručním zadání souřadnic
  useEffect(() => {
    const map = mapRef.current, marker = markerRef.current
    if (!map || !marker || !readyRef.current) return
    const cur = marker.getLngLat()
    if (Math.abs(cur.lat - lat) > 0.0001 || Math.abs(cur.lng - lng) > 0.0001) {
      marker.setLngLat([lng, lat])
      map.easeTo({ center: [lng, lat], duration: 300 })
    }
    applyRadius()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, radiusKm])

  function applyRadius() {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const has = !!map.getSource('adm-radius')
    if (radiusKm > 0) {
      const data = circlePolygon(lat, lng, radiusKm) as Feature
      if (has) { (map.getSource('adm-radius') as GeoJSONSource).setData(data) }
      else {
        map.addSource('adm-radius', { type: 'geojson', data })
        map.addLayer({ id: 'adm-radius-fill', type: 'fill', source: 'adm-radius', paint: { 'fill-color': '#d97757', 'fill-opacity': 0.1 } })
        map.addLayer({ id: 'adm-radius-line', type: 'line', source: 'adm-radius', paint: { 'line-color': '#d97757', 'line-width': 2, 'line-dasharray': [3, 2] } })
      }
    } else if (has) {
      if (map.getLayer('adm-radius-fill')) map.removeLayer('adm-radius-fill')
      if (map.getLayer('adm-radius-line')) map.removeLayer('adm-radius-line')
      map.removeSource('adm-radius')
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: 340, borderRadius: 10, border: '1px solid var(--line)', overflow: 'hidden' }} />
      <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-3)', background: 'rgba(245,241,232,0.92)', padding: '3px 12px', borderRadius: 999, pointerEvents: 'none', zIndex: 1000 }}>
        KLIKNI NA MAPU · NEBO TÁHNI PIN
      </div>
    </div>
  )
}
