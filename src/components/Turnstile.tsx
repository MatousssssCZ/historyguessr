import { useEffect, useRef } from 'react'
import { CAPTCHA_ENABLED, TURNSTILE_SITE_KEY, loadTurnstile } from '@/lib/turnstile'

interface Props {
  onToken: (token: string | null) => void
  theme?: 'light' | 'dark' | 'auto'
}

// Cloudflare Turnstile widget. Bez klíče (CAPTCHA_ENABLED=false) nevykreslí nic
// a rovnou hlásí „token není potřeba" přes onToken(''), aby formuláře nešly blokovat.
// Reset se dělá remountem (změnou `key` z rodiče) — token je jednorázový.
export default function Turnstile({ onToken, theme = 'auto' }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    if (!CAPTCHA_ENABLED) { onToken(''); return }
    let cancelled = false
    loadTurnstile().then(() => {
      if (cancelled || !ref.current || !window.turnstile) return
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme,
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      })
    })
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current) } catch { /* už odstraněn */ }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!CAPTCHA_ENABLED) return null
  return <div ref={ref} style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }} />
}
