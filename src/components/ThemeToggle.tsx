import { useState } from 'react'
import { getTheme, toggleTheme } from '@/lib/theme'

/**
 * Přepínač světlý/tmavý režim.
 * variant="dark"  → pro tmavé plochy (desktop hero, herní HUD)
 * variant="light" → adaptivní (používá tokeny, sám se přizpůsobí tématu)
 */
export default function ThemeToggle({ variant = 'light' }: { variant?: 'dark' | 'light' }) {
  const [theme, setThemeState] = useState(getTheme())
  const isDark = theme === 'dark'

  const style: React.CSSProperties = variant === 'dark'
    ? {
        // na feature ploše — barva i ikona se přizpůsobí tématu
        background: 'var(--feature-chip)', border: '1px solid var(--feature-line)',
        color: 'var(--feature-fg2)',
      }
    : {
        background: 'rgba(42,31,23,0.05)', border: '1px solid var(--line)',
        color: 'var(--ink-3)',
      }

  return (
    <button
      onClick={() => setThemeState(toggleTheme())}
      aria-label={isDark ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}
      title={isDark ? 'Světlý režim' : 'Tmavý režim'}
      style={{
        ...style,
        width: 34, height: 34, borderRadius: 8, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, lineHeight: 1, padding: 0, flexShrink: 0,
      }}
    >
      {isDark ? '☀' : '☾'}
    </button>
  )
}
