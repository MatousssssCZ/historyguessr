import { useEffect, useState } from 'react'

// Sdílený náklon zařízení (mobil: DeviceOrientation, jinde: pohyb kurzoru/dotyku).
// Jediná sada window listenerů pro celou appku, odznaky jen odebírají — takže i
// desítky odznaků v žebříčku nepřidávají desítky listenerů.
export interface Tilt { x: number; y: number }  // -1..1

let current: Tilt = { x: 0, y: 0 }
const subs = new Set<(t: Tilt) => void>()
let started = false
let raf = 0

const clamp = (v: number) => Math.max(-1, Math.min(1, v))
function push(x: number, y: number) {
  current = { x: clamp(x), y: clamp(y) }
  if (raf) return
  raf = requestAnimationFrame(() => { raf = 0; subs.forEach(fn => fn(current)) })
}

function ensureStarted() {
  if (started || typeof window === 'undefined') return
  started = true
  const onOrient = (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return
    push(e.gamma / 45, (e.beta - 45) / 45)
  }
  const onPointer = (e: PointerEvent) => {
    push((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
  }
  if ('DeviceOrientationEvent' in window) window.addEventListener('deviceorientation', onOrient, { passive: true })
  window.addEventListener('pointermove', onPointer, { passive: true })
}

/** iOS 13+ vyžaduje jednorázové povolení po gestu — zavolej z onClick. Jinde no-op. */
export async function enableTilt(): Promise<void> {
  type DOE = { requestPermission?: () => Promise<'granted' | 'denied'> }
  const doe = (window as unknown as { DeviceOrientationEvent?: DOE }).DeviceOrientationEvent
  if (doe?.requestPermission) { try { await doe.requestPermission() } catch { /* ignore */ } }
  ensureStarted()
}

export function useTilt(): Tilt {
  const [t, setT] = useState<Tilt>(current)
  useEffect(() => {
    ensureStarted()
    subs.add(setT)
    return () => { subs.delete(setT) }
  }, [])
  return t
}
