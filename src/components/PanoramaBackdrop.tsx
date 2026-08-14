import { useEffect, useRef, useState } from 'react'
import { getRandomPanoramas } from '@/lib/supabase'
import { encodePanoramaUrl } from '@/lib/panorama'

declare const pannellum: {
  viewer: (el: HTMLElement, cfg: Record<string, unknown>) => { destroy: () => void }
}

// Ambientní pozadí přihlašovací obrazovky ve stylu Street View: skutečné 3D
// panorama (Pannellum) se pomalu otáčí horizontálně a cross-fade mezi 5
// náhodnými scénami. Dvě vrstvy A/B se střídají, aby přechod byl plynulý.
// Neinteraktivní (draggable false) a pointerEvents none → neruší formulář.

const ROTATE_DEG_PER_SEC = -3   // rychlost horizontálního otáčení (Street View pan)
const SCENE_MS = 12000          // jak dlouho je jedna scéna vidět
const FADE_MS = 1800            // délka prolnutí

export default function PanoramaBackdrop() {
  const [urls, setUrls] = useState<string[]>([])
  const layerRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)]

  useEffect(() => {
    let alive = true
    getRandomPanoramas(5).then(list => {
      if (alive) setUrls(list)
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (urls.length === 0 || typeof pannellum === 'undefined') return
    const els = [layerRefs[0].current, layerRefs[1].current]
    if (!els[0] || !els[1]) return

    const instances: (({ destroy: () => void }) | null)[] = [null, null]
    let cur = 0
    let idx = 0
    let disposed = false
    const timeouts: ReturnType<typeof setTimeout>[] = []

    const cfg = (url: string) => ({
      type: 'equirectangular',
      panorama: encodePanoramaUrl(url),
      autoLoad: true,
      autoRotate: ROTATE_DEG_PER_SEC,
      showControls: false,
      draggable: false,
      mouseZoom: false,
      keyboardZoom: false,
      disableKeyboardCtrl: true,
      showZoomCtrl: false,
      showFullscreenCtrl: false,
      hfov: 132,
      minHfov: 132,
      maxHfov: 132,
      friction: 1,
    })

    const build = (layer: number, url: string) => {
      const el = els[layer]!
      el.innerHTML = ''
      try { instances[layer] = pannellum.viewer(el, cfg(url)) }
      catch { instances[layer] = null }
    }

    // úvodní scéna
    build(0, urls[idx])
    els[0].style.opacity = '1'
    els[1].style.opacity = '0'

    const rotate = setInterval(() => {
      if (disposed || urls.length < 2) return
      const next = cur === 0 ? 1 : 0
      const nextIdx = (idx + 1) % urls.length
      instances[next]?.destroy()
      build(next, urls[nextIdx])
      // dej Pannellu chvíli na načtení, pak prolni
      timeouts.push(setTimeout(() => {
        if (disposed) return
        els[next]!.style.opacity = '1'
        els[cur]!.style.opacity = '0'
        const prev = cur
        cur = next; idx = nextIdx
        timeouts.push(setTimeout(() => {
          if (disposed) return
          instances[prev]?.destroy(); instances[prev] = null
          if (els[prev]) els[prev]!.innerHTML = ''
        }, FADE_MS + 100))
      }, 1400))
    }, SCENE_MS)

    return () => {
      disposed = true
      clearInterval(rotate)
      timeouts.forEach(clearTimeout)
      instances.forEach(v => v?.destroy())
    }
  }, [urls])

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#161009', pointerEvents: 'none' }}>
      {[0, 1].map(i => (
        <div key={i} ref={layerRefs[i]} style={{ position: 'absolute', inset: 0, opacity: 0, transition: `opacity ${FADE_MS}ms ease-in-out` }}/>
      ))}
    </div>
  )
}
