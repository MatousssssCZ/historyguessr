import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Map as MLMap, Marker, LngLatBounds } from 'maplibre-gl'
import type { Feature } from 'geojson'
import {
  MAP_STYLE, GUESS_FILL, GUESS_STROKE, TRUTH_FILL, TRUTH_STROKE,
  wrapLng, makePinElement, circlePolygon, createMapWhenSized,
} from '@/lib/mapTiles'

// Pozn.: NEPŘEDÁVÁME maxBounds v konstruktoru (maplibre-gl 6.x při init padá).
// Jeden svět zajistí renderWorldCopies:false; klik normalizujeme wrapLng().
// Vrstvy/markery přidáváme na 'style.load' (event 'load' se v některých
// prostředích nefíruje spolehlivě).

// ─────────────────────────────────────────────────────────
// GuessMap — herní mapa pro tipování
// ─────────────────────────────────────────────────────────
interface GuessMapProps {
  onGuess: (lat: number, lng: number) => void
  guessLat: number | null
  guessLng: number | null
  compact?: boolean  // miniaturní mód pro kruhový puck
}

export function GuessMap({ onGuess, guessLat, guessLng, compact }: GuessMapProps) {
  const { t } = useTranslation()
  const wrapRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const readyRef = useRef(false)
  const onGuessRef = useRef(onGuess)
  onGuessRef.current = onGuess

  function placeMarker(lat: number, lng: number) {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    if (markerRef.current) { markerRef.current.setLngLat([lng, lat]); return }
    const m = new Marker({ element: makePinElement(GUESS_FILL, GUESS_STROKE), anchor: 'bottom', draggable: !compact })
      .setLngLat([lng, lat]).addTo(map)
    if (!compact) {
      m.on('dragend', () => {
        const p = m.getLngLat(); const wl = wrapLng(p.lng)
        m.setLngLat([wl, p.lat]); onGuessRef.current(p.lat, wl)
      })
    }
    markerRef.current = m
  }

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || mapRef.current) return
    return createMapWhenSized(wrap,
      (el) => new MLMap({
        container: el, style: MAP_STYLE, center: [0, 20], zoom: compact ? 1 : 1.4,
        minZoom: 0.5, maxZoom: 18, interactive: !compact, renderWorldCopies: false,
        attributionControl: compact ? false : { compact: true },
        dragRotate: false, pitchWithRotate: false,
      }),
      (map) => {
        mapRef.current = map
        if (!compact) {
          map.on('click', (e) => {
            if (!readyRef.current) return
            const lat = e.lngLat.lat; const lng = wrapLng(e.lngLat.lng)
            placeMarker(lat, lng); onGuessRef.current(lat, lng)
          })
        }
        map.on('style.load', () => {
          readyRef.current = true
          if (guessLat != null && guessLng != null) {
            placeMarker(guessLat, wrapLng(guessLng))
            map.jumpTo({ center: [wrapLng(guessLng), guessLat], zoom: compact ? 3 : 4 })
          }
        })
      })
    // cleanup vrací createMapWhenSized (odpojí RO, odstraní mapu)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset ready/marker refů při odmountování je součástí cleanupu mapy výše;
  // markerRef necháváme nulovat zde jen logicky (mapa se stejně odstraní).

  // Synchronizace pinu podle props
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    if (guessLat != null && guessLng != null) {
      placeMarker(guessLat, wrapLng(guessLng))
      if (compact) map.jumpTo({ center: [wrapLng(guessLng), guessLat], zoom: 3 })
    } else if (markerRef.current) {
      markerRef.current.remove(); markerRef.current = null
      if (compact) map.jumpTo({ center: [0, 20], zoom: 1 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guessLat, guessLng, compact])

  if (compact) {
    return <div ref={wrapRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={wrapRef} style={{ width: '100%', height: '100%', minHeight: 200 }} />
      {guessLat === null && (
        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 1000, whiteSpace: 'nowrap' }}>
          <div style={{ background: 'rgba(42,31,23,0.65)', backdropFilter: 'blur(6px)', padding: '5px 12px', borderRadius: 999, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'rgba(245,241,232,0.85)' }}>
            {t('game.clickToPin')}
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
  const { t } = useTranslation()
  const wrapRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || mapRef.current) return
    const gLng = wrapLng(guessLng)
    const tLng = wrapLng(truthLng)
    return createMapWhenSized(wrap,
      (el) => new MLMap({
        container: el, style: MAP_STYLE,
        center: [(gLng + tLng) / 2, (guessLat + truthLat) / 2], zoom: 3,
        maxZoom: 18, renderWorldCopies: false, attributionControl: { compact: true },
        dragRotate: false, pitchWithRotate: false,
      }),
      (map) => {
        mapRef.current = map
        map.on('style.load', () => {
          new Marker({ element: makePinElement(GUESS_FILL, GUESS_STROKE, t('game.yourGuessMap')), anchor: 'bottom' })
            .setLngLat([gLng, guessLat]).addTo(map)
          const truth = new Marker({ element: makePinElement(TRUTH_FILL, TRUTH_STROKE, t('game.correctPlace')), anchor: 'bottom' })
            .setLngLat([tLng, truthLat]).addTo(map)
          // MapLibre řadí markery podle šířky (severnější = vzadu). Správné místo
          // ale musí být vždy navrchu, ať ho tip nepřekryje. Mapa je statická (jen
          // fitBounds), takže ruční z-index drží.
          truth.getElement().style.zIndex = '3'
          map.addSource('line', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[gLng, guessLat], [tLng, truthLat]] } } })
          map.addLayer({ id: 'line', type: 'line', source: 'line', paint: { 'line-color': '#d97757', 'line-width': 2, 'line-dasharray': [3, 2], 'line-opacity': 0.85 } })
          if (radiusKm > 0) {
            map.addSource('radius', { type: 'geojson', data: circlePolygon(truthLat, tLng, radiusKm) as Feature })
            map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': '#2a1f17', 'fill-opacity': 0.06 } })
            map.addLayer({ id: 'radius-line', type: 'line', source: 'radius', paint: { 'line-color': '#2a1f17', 'line-width': 1.2, 'line-dasharray': [2, 2], 'line-opacity': 0.5 } })
          }
          const b = new LngLatBounds([gLng, guessLat], [gLng, guessLat])
          b.extend([tLng, truthLat])
          map.fitBounds(b, { padding: 70, maxZoom: 9, animate: false })
        })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={wrapRef} style={{ width: '100%', height: '100%', minHeight: 120, overflow: 'hidden' }} />
}
