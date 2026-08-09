import { useEffect, useRef, useState } from 'react'
import { getMyEntitlements } from '@/lib/supabase'
import { type Entitlements } from '@/lib/entitlements'
import { shouldShowAdAt, adSlotId, ADSENSE_CLIENT, AD_ENABLED, type AdPlacement } from '@/lib/ads'

// Jednorázové načtení AdSense skriptu. Google si sám řeší GDPR souhlas
// (AdSense → Privacy & messaging), pokud je zapnutý — vlastní CMP neděláme.
// Skript už je většinou v index.html (kvůli ověření webu) — pak ho znovu
// nevkládáme, jen počkáme, až bude knihovna k dispozici.
let scriptPromise: Promise<void> | null = null
function loadAdSense(): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve) => {
    // Už načtený (index.html) → hotovo
    if (document.querySelector('script[src*="adsbygoogle.js"]')) { resolve(); return }
    const s = document.createElement('script')
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
    s.async = true
    s.crossOrigin = 'anonymous'
    s.onload = () => resolve()
    s.onerror = () => resolve() // best-effort; neblokuj UI
    document.head.appendChild(s)
  })
  return scriptPromise
}

interface Props {
  placement: AdPlacement
  /** Nepovinný nadpis nad reklamou (transparentnost). */
  label?: string
  style?: React.CSSProperties
}

/**
 * Reklamní blok. Sám rozhodne, zda se smí zobrazit (placement + Premium +
 * přítomnost AdSense klíče). Bez klíče / pro Premium vykreslí null.
 */
export default function AdSlot({ placement, label, style }: Props) {
  const insRef = useRef<HTMLModElement | null>(null)
  const [ent, setEnt] = useState<Entitlements | null | undefined>(undefined)
  const slot = adSlotId(placement)

  // Bez klíče/slotu se ani neptáme na entitlementy.
  useEffect(() => {
    if (!AD_ENABLED || !slot) return
    let cancelled = false
    getMyEntitlements().then(e => { if (!cancelled) setEnt(e) }).catch(() => { if (!cancelled) setEnt(null) })
    return () => { cancelled = true }
  }, [slot])

  // Dokud entitlementy nedorazí (undefined), nic nezobrazuj — ať reklama
  // neblikne Premium uživateli.
  const allowed = AD_ENABLED && !!slot && ent !== undefined && shouldShowAdAt(placement, ent)

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    loadAdSense().then(() => {
      if (cancelled) return
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
      } catch { /* prázdný slot / blokovaný — ignoruj */ }
    })
    return () => { cancelled = true }
  }, [allowed])

  if (!allowed) return null

  return (
    <div style={{ margin: '16px 0', textAlign: 'center', ...style }}>
      {label && (
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4, letterSpacing: 0.4 }}>
          {label}
        </div>
      )}
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
