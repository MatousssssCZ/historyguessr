// Cloudflare Turnstile — ochrana přihlášení/registrace/host proti botům.
// AKTIVNÍ jen když je nastaven VITE_TURNSTILE_SITE_KEY (jinak úplně vypnuto).
// Secret key žije POUZE v Supabase (Auth → Attack Protection → CAPTCHA).

export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || ''
export const CAPTCHA_ENABLED = !!TURNSTILE_SITE_KEY

// Typ pro window.turnstile (jen co používáme)
interface TurnstileAPI {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  remove: (id: string) => void
  reset: (id?: string) => void
}
declare global {
  interface Window { turnstile?: TurnstileAPI }
}

let scriptPromise: Promise<void> | null = null
export function loadTurnstile(): Promise<void> {
  if (!CAPTCHA_ENABLED) return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => resolve() // best-effort — neblokuj přihlášení, když CF nejede
    document.head.appendChild(s)
  })
  return scriptPromise
}
