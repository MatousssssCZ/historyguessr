// Vizuální odznak prostředí — aby sis nikdy nespletl LOCAL/TEST s produkcí.
// Zobrazí se jen mimo produkci; řídí se VITE_APP_ENV (fallback: detekce
// lokální Supabase URL). Na produkci (VITE_APP_ENV=production) je neviditelný.

const RAW_ENV = (import.meta.env.VITE_APP_ENV as string | undefined)?.toLowerCase()
const IS_LOCAL_DB = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.includes('127.0.0.1')
  || (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.includes('localhost')

// Prostředí: explicitní VITE_APP_ENV má přednost, jinak odhad z URL.
const ENV = RAW_ENV ?? (IS_LOCAL_DB ? 'local' : 'production')

const LABELS: Record<string, { text: string; bg: string }> = {
  local: { text: 'LOCAL', bg: '#2f6b4f' },
  test: { text: 'TEST', bg: '#b5820f' },
}

export default function EnvBadge() {
  const cfg = LABELS[ENV]
  if (!cfg) return null // production → nic
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)', left: 8,
        zIndex: 2147483647, pointerEvents: 'none',
        background: cfg.bg, color: '#fff',
        fontFamily: 'var(--font-mono, monospace)', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
        padding: '4px 9px', borderRadius: 7, opacity: 0.82,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      {cfg.text}
    </div>
  )
}
