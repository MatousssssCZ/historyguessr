import { createElement, useEffect, useState } from 'react'

// model-viewer (Google web component) — líně načtený z CDN až když je potřeba.
let mvPromise: Promise<boolean> | null = null
function loadModelViewer(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  const w = window as unknown as { customElements?: CustomElementRegistry }
  if (w.customElements?.get('model-viewer')) return Promise.resolve(true)
  if (mvPromise) return mvPromise
  mvPromise = new Promise(resolve => {
    const s = document.createElement('script')
    s.type = 'module'
    s.src = 'https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js'
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
  return mvPromise
}

/** Zobrazí relikvii: 3D (GLB, otáčení tažením + autorotace) když je model, jinak obrázek, jinak ikonu. */
export default function RelicViewer({ modelUrl, imageUrl, glow, fallback }: {
  modelUrl?: string | null
  imageUrl?: string | null
  glow?: 'gold' | 'stone'
  fallback?: string
}) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    if (modelUrl) loadModelViewer().then(ok => { if (alive) setReady(ok) })
    return () => { alive = false }
  }, [modelUrl])

  if (modelUrl && ready) {
    return createElement('model-viewer', {
      src: modelUrl,
      'auto-rotate': true,
      'rotation-per-second': '24deg',
      'camera-controls': true,
      'touch-action': 'pan-y',
      'interaction-prompt': 'none',
      'shadow-intensity': '0.8',
      exposure: '1.05',
      'environment-image': 'neutral',
      style: { width: '100%', height: '100%', background: 'transparent', '--poster-color': 'transparent' } as React.CSSProperties,
    })
  }
  if (imageUrl) {
    return <img src={imageUrl} alt="" style={{ position: 'relative', width: '62%', height: '76%', objectFit: 'contain' }}/>
  }
  return <span style={{ position: 'relative', fontSize: 76, color: glow === 'gold' ? '#E8C88A' : '#D8CFBF' }}>{fallback ?? '🏺'}</span>
}
