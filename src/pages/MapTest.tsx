import { useEffect, useRef, useState } from 'react'
import { Map as MLMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAP_STYLE, createMapWhenSized } from '@/lib/mapTiles'

// Dočasná diagnostika: ověření MapLibre + OpenFreeMap pod produkční CSP (bez auth).
export default function MapTestPage() {
  const ref = useRef<HTMLDivElement>(null)
  const [log, setLog] = useState<string[]>([])
  const add = (m: string) => setLog(l => [...l, m])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    add('mount')
    return createMapWhenSized(el,
      (c) => new MLMap({ container: c, style: MAP_STYLE, center: [14, 50], zoom: 3, renderWorldCopies: false, attributionControl: { compact: true } }),
      (map) => {
        add('Map() OK')
        map.on('error', e => add('ERR: ' + (e?.error?.message || 'unknown')))
        map.on('style.load', () => { add('style.load'); new Marker().setLngLat([14.42, 50.08]).addTo(map) })
        map.on('idle', () => add('idle'))
      })
  }, [])
  return (
    <div style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>
      <div ref={ref} style={{ width: '100%', height: 320, border: '1px solid #ccc' }} />
      <pre style={{ background: '#111', color: '#0f0', padding: 8, marginTop: 8 }}>{log.join('\n')}</pre>
    </div>
  )
}
