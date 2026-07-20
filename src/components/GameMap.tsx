import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import L from 'leaflet'

// Leaflet tile URL a attributace
// {r} + detectRetina → na HiDPI displejích načte ostré @2x dlaždice
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'

// Fyzická mapa (Esri World Physical): barevná hypsometrie souše (hory/nížiny)
// i reliéf oceánského dna a příkopy. Nativně jen do zoom 8 → výš se přiblíží
// (overzoom) přes maxNativeZoom; přesnost umístění to nemění, jen ostrost dlaždic.
const PHYS_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}'
const PHYS_ATTR = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; US National Park Service'
const PHYS_MAX_NATIVE = 8

// Custom ikony (SVG inline — bez externích PNG souborů)
const makeIcon = (fill: string, stroke: string) => L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 22 28">
    <path d="M11 27s9-9 9-16a9 9 0 1 0-18 0c0 7 9 16 9 16Z" fill="${fill}" stroke="${stroke}" stroke-width="1"/>
    <circle cx="11" cy="11" r="3.2" fill="#fff"/>
  </svg>`,
  iconSize: [26, 34],
  iconAnchor: [13, 34],
  popupAnchor: [0, -34],
})

const GUESS_ICON = makeIcon('#d97757', '#b85a3e')   // tip hráče — oranžový
const TRUTH_ICON = makeIcon('#1f9d57', '#157a42')   // správné místo — zelený

// Normalizuj zeměpisnou délku do <-180, 180> — zabrání tipu „o mapu vedle"
// při posunu mapy přes okraj světa (Leaflet jinak vrací např. 300° nebo -300°)
function wrapLng(lng: number): number {
  return ((lng + 180) % 360 + 360) % 360 - 180
}

// Omezení mapy na jediný svět (žádné nekonečné kopie)
const WORLD_BOUNDS: L.LatLngBoundsExpression = [[-85, -180], [85, 180]]

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
  compact?: boolean  // miniaturní mód pro kruhový puck
}

export function GuessMap({ onGuess, guessLat, guessLng, compact }: GuessMapProps) {
  const { t } = useTranslation()
  const wrapRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const roRef = useRef<ResizeObserver | null>(null)
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

      // Inicializuj mapu — compact používá minimální (jistou) konfiguraci
      const map = L.map(wrap, {
        center: [20, 0],
        zoom: compact ? 1 : 2,
        minZoom: 1,
        maxZoom: 18,
        zoomControl: !compact,
        dragging: !compact,
        scrollWheelZoom: !compact,
        doubleClickZoom: !compact,
        boxZoom: !compact,
        keyboard: !compact,
        attributionControl: !compact,
        ...(compact ? {} : { worldCopyJump: true, maxBounds: WORLD_BOUNDS, maxBoundsViscosity: 1.0 }),
      })

      L.tileLayer(PHYS_URL, {
        attribution: PHYS_ATTR,
        maxNativeZoom: PHYS_MAX_NATIVE,
        maxZoom: 18,
        ...(compact ? {} : { noWrap: true }),
      }).addTo(map)

      // Odstraň Leaflet prefix (vlajku + „Leaflet"); ponech jen povinnou
      // atribuci dat (OpenStreetMap, CARTO)
      map.attributionControl?.setPrefix(false)

      // Oprav offset — zavolej invalidateSize IHNED po inicializaci
      // a pak ještě 3x s různými delays
      map.invalidateSize({ animate: false })
      setTimeout(() => { map.invalidateSize({ animate: false }) }, 100)
      setTimeout(() => { map.invalidateSize({ animate: false }) }, 300)
      setTimeout(() => { map.invalidateSize({ animate: false }) }, 600)

      // Click handler jen u plné mapy; compact je jen náhled
      if (!compact) {
        map.on('click', (e: L.LeafletMouseEvent) => {
          const ll = L.latLng(e.latlng.lat, wrapLng(e.latlng.lng))
          if (markerRef.current) {
            markerRef.current.setLatLng(ll)
          } else {
            const m = L.marker(ll, { icon: GUESS_ICON, draggable: true }).addTo(map)
            m.on('dragend', () => {
              const pos = m.getLatLng()
              const wrapped = L.latLng(pos.lat, wrapLng(pos.lng))
              m.setLatLng(wrapped)
              onGuessRef.current(wrapped.lat, wrapped.lng)
            })
            markerRef.current = m
          }
          onGuessRef.current(ll.lat, ll.lng)
        })
      }

      // Pokud už pin existuje, vykresli ho a vycentruj na něj
      if (guessLat != null && guessLng != null) {
        markerRef.current = L.marker([guessLat, guessLng], { icon: GUESS_ICON, draggable: !compact }).addTo(map)
        if (!compact) {
          markerRef.current.on('dragend', () => {
            const pos = markerRef.current!.getLatLng()
            const wrapped = L.latLng(pos.lat, wrapLng(pos.lng))
            markerRef.current!.setLatLng(wrapped)
            onGuessRef.current(wrapped.lat, wrapped.lng)
          })
        }
        map.setView([guessLat, guessLng], compact ? 4 : 5, { animate: false })
      }

      mapRef.current = map

      // Překresli mapu při změně velikosti kontejneru (roztahování panelu)
      const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }))
      ro.observe(wrap)
      roRef.current = ro
    }

    // Spusť inicializaci po prvním frame
    requestAnimationFrame(initWhenReady)

    return () => {
      roRef.current?.disconnect()
      roRef.current = null
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
    }
  }, [])

  // Synchronizuj pin podle props (compact náhled na dlaždici se posune k pinu)
  useEffect(() => {
    let raf = 0
    function apply() {
      const map = mapRef.current
      if (!map) { raf = requestAnimationFrame(apply); return }
      if (guessLat != null && guessLng != null) {
        const ll = L.latLng(guessLat, guessLng)
        if (markerRef.current) markerRef.current.setLatLng(ll)
        else markerRef.current = L.marker(ll, { icon: GUESS_ICON, draggable: !compact }).addTo(map)
        if (compact) map.setView(ll, 4, { animate: false })
      } else if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
        if (compact) map.setView([20, 0], 1, { animate: false })
      }
    }
    apply()
    return () => cancelAnimationFrame(raf)
  }, [guessLat, guessLng, compact])

  if (compact) {
    // absolute inset:0 → spolehlivá velikost na všech prohlížečích (i iOS Safari)
    return (
      <div
        ref={wrapRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={wrapRef}
        style={{ width: '100%', height: '100%', minHeight: 200 }}
      />
      {guessLat === null && (
        <div style={{
          position: 'absolute', bottom: 10, left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none', zIndex: 1000,
          whiteSpace: 'nowrap',
        }}>
          <div style={{
            background: 'rgba(42,31,23,0.65)',
            backdropFilter: 'blur(6px)',
            padding: '5px 12px', borderRadius: 999,
            fontFamily: 'var(--font-mono)', fontSize: 10,
            letterSpacing: '0.12em', color: 'rgba(245,241,232,0.85)',
          }}>
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

      const map = L.map(wrap, { maxBounds: WORLD_BOUNDS, maxBoundsViscosity: 1.0 })
      L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19, noWrap: true, detectRetina: true }).addTo(map)
      map.attributionControl?.setPrefix(false)

      // Normalizuj délky (i pro starší uložené tipy „o mapu vedle")
      const gLng = wrapLng(guessLng)
      const tLng = wrapLng(truthLng)

      // Piny
      L.marker([guessLat, gLng], { icon: GUESS_ICON })
        .addTo(map)
        .bindTooltip(t('game.yourGuessMap'), { permanent: true, direction: 'right', offset: [8, -16] })

      L.marker([truthLat, tLng], { icon: TRUTH_ICON })
        .addTo(map)
        .bindTooltip(t('game.correctPlace'), { permanent: true, direction: 'right', offset: [8, -16] })

      // Linka
      L.polyline([[guessLat, gLng], [truthLat, tLng]], {
        color: '#d97757', weight: 2, dashArray: '6 4', opacity: 0.8,
      }).addTo(map)

      // Radius
      if (radiusKm > 0) {
        L.circle([truthLat, tLng], {
          radius: radiusKm * 1000,
          color: '#2a1f17', fillColor: '#2a1f17', fillOpacity: 0.06,
          weight: 1.5, dashArray: '4 4',
        }).addTo(map)
      }

      // Fit bounds
      const bounds = L.latLngBounds([guessLat, gLng], [truthLat, tLng])
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 })
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
        width: '100%', height: '100%', minHeight: 120,
        overflow: 'hidden',
      }}
    />
  )
}
