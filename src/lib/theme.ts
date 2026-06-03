export type Theme = 'light' | 'dark'
const KEY = 'hg_theme'

export function getTheme(): Theme {
  try { return (localStorage.getItem(KEY) as Theme) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}

export function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
}

export function setTheme(t: Theme) {
  try { localStorage.setItem(KEY, t) } catch { /* ignore */ }
  applyTheme(t)
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}
