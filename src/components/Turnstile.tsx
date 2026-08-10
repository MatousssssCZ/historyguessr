import { useEffect, useRef } from 'react'
import { CAPTCHA_ENABLED, TURNSTILE_SITE_KEY, loadTurnstile } from '@/lib/turnstile'

interface Props {
  onToken: (token: string | null) => void
  theme?: 'light' | 'dark' | 'auto'
  // 'always' = viditelný widget; 'interaction-only' = neviditelný, ukáže se
  // jen když Cloudflare vyžaduje interakci (pro login/registraci).
  appearance?: 'always' | 'interaction-only'
  // Zavolá se, když se ověření nepodaří načíst/vyřešit (blokovač, síť, výpadek).
  onError?: () => void
}

// Cloudflare Turnstile widget. Bez klíče (CAPTCHA_ENABLED=false) nevykreslí nic
// a rovnou hlásí „token není potřeba" přes onToken(''), aby formuláře nešly blokovat.
// Reset se dělá remountem (změnou `key` z rodiče) — token je jednorázový.
export default function Turnstile({ onToken, theme = 'auto', appearance = 'always', onError }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    if (!CAPTCHA_ENABLED) { onToken(''); return }
    let cancelled = false
    let settled = false
    // Pojistka: když do 15 s nedorazí token (skript se nenačetl / neproběhlo
    // vykreslení), ohlásíme chybu, ať se hráč nezasekne na tichém čekání.
    const timeout = setTimeout(() => { if (!cancelled && !settled) onError?.() }, 15000)
    loadTurnstile().then(() => {
      if (cancelled) return
      if (!ref.current || !window.turnstile) { onError?.(); return } // skript se nenačetl
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme,
        appearance,
        callback: (token: string) => { settled = true; onToken(token) },
        'expired-callback': () => onToken(null),
        'error-callback': () => { onToken(null); onError?.() },
      })
    })
    return () => {
      cancelled = true
      clearTimeout(timeout)
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current) } catch { /* už odstraněn */ }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!CAPTCHA_ENABLED) return null
  return <div ref={ref} style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }} />
}
