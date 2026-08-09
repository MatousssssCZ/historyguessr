import * as Sentry from '@sentry/react'

// Sledování chyb v produkci. AKTIVNÍ jen když je nastaven VITE_SENTRY_DSN
// (jinak je Sentry úplně vypnutý — nulová režie). DSN patří do Vercel env.
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_APP_ENV as string) || 'production',
    // Jen zlomek transakcí (výkon) — chyby se posílají všechny.
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      // Scrubbing: neposílej osobní data (e-mail, IP, query stringy).
      if (event.user) { delete event.user.email; delete event.user.ip_address }
      if (event.request) { delete event.request.query_string; delete event.request.cookies }
      return event
    },
  })
}

export { Sentry }
