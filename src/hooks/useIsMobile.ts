import { useEffect, useState } from 'react'

// Jednotná hranice mobil/desktop pro celou aplikaci.
// (Dřív se používalo 640 / 768 / 900 nekonzistentně napříč stránkami.)
export const MOBILE_BREAKPOINT = 768

/** true, když je viewport užší než `breakpoint`. Reaguje na resize i otočení. */
export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint,
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return isMobile
}
