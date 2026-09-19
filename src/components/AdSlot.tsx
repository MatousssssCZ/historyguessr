import { useEffect, useRef, useState, useId } from 'react'
import { getMyEntitlements } from '@/lib/supabase'
import { type Entitlements } from '@/lib/entitlements'
import { shouldShowAdAt, adSlotId, ADSENSE_CLIENT, NITRO_SITE_ID, AD_PROVIDER, AD_ENABLED, type AdPlacement } from '@/lib/ads'

// ── AdSense loader ────────────────────────────────────────
let adsenseScript: Promise<void> | null = null
function loadAdSense(): Promise<void> {
  if (adsenseScript) return adsenseScript
  adsenseScript = new Promise<void>((resolve) => {
    if (document.querySelector('script[src*="adsbygoogle.js"]')) { resolve(); return }
    const s = document.createElement('script')
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
    s.async = true; s.crossOrigin = 'anonymous'
    s.onload = () => resolve(); s.onerror = () => resolve()
    document.head.appendChild(s)
  })
  return adsenseScript
}

// ── Nitro (NitroPay) loader ───────────────────────────────
let nitroScript: Promise<void> | null = null
function loadNitro(): Promise<void> {
  if (nitroScript) return nitroScript
  nitroScript = new Promise<void>((resolve) => {
    if (document.querySelector('script[src*="nitropay.com/ads-"]')) { resolve(); return }
    // NitroPay per-site skript. Vestavěná CMP (GDPR) se řeší přes Nitro dashboard.
    ;(window as unknown as { nitroAds?: { createAd: unknown } }).nitroAds ||= { createAd: () => {} } as never
    const s = document.createElement('script')
    s.src = `https://s.nitropay.com/ads-${NITRO_SITE_ID}.js`
    s.async = true
    s.onload = () => resolve(); s.onerror = () => resolve()
    document.head.appendChild(s)
  })
  return nitroScript
}

interface Props {
  placement: AdPlacement
  label?: string
  style?: React.CSSProperties
}

/**
 * Reklamní blok. Sám rozhodne, zda se smí zobrazit (placement + Premium +
 * přítomnost klíčů). Podporuje Nitro i AdSense; bez konfigurace vykreslí null.
 */
export default function AdSlot({ placement, label, style }: Props) {
  const nitroRef = useRef<HTMLDivElement | null>(null)
  const [ent, setEnt] = useState<Entitlements | null | undefined>(undefined)
  const uid = useId().replace(/:/g, '')
  const slot = adSlotId(placement)

  useEffect(() => {
    if (!AD_ENABLED || !slot) return
    let cancelled = false
    getMyEntitlements().then(e => { if (!cancelled) setEnt(e) }).catch(() => { if (!cancelled) setEnt(null) })
    return () => { cancelled = true }
  }, [slot])

  const allowed = AD_ENABLED && !!slot && ent !== undefined && shouldShowAdAt(placement, ent)

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    if (AD_PROVIDER === 'nitro') {
      loadNitro().then(() => {
        if (cancelled || !nitroRef.current) return
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const na = (window as any).nitroAds
          na?.createAd?.(nitroRef.current.id, {
            demandProvider: 'default',
            format: 'display',
            sizes: [['300', '250'], ['336', '280'], ['320', '100']],
            report: { enabled: true, wording: 'Nahlásit reklamu', position: 'top-right' },
            renderVisibleOnly: true,
          })
        } catch { /* blokováno / prázdné — ignoruj */ }
      })
    } else {
      loadAdSense().then(() => {
        if (cancelled) return
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
        } catch { /* prázdný slot / blokovaný — ignoruj */ }
      })
    }
    return () => { cancelled = true }
  }, [allowed, uid])

  if (!allowed) return null

  return (
    <div style={{ margin: '16px 0', textAlign: 'center', ...style }}>
      {label && (
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4, letterSpacing: 0.4 }}>{label}</div>
      )}
      {AD_PROVIDER === 'nitro' ? (
        <div id={`na-${uid}`} ref={nitroRef} data-nitro-unit={slot} style={{ minHeight: 100, display: 'flex', justifyContent: 'center' }}/>
      ) : (
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      )}
    </div>
  )
}
