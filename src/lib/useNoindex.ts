import { useEffect } from 'react'

// Přidá <meta name="robots" content="noindex, follow"> po dobu, co je stránka
// zobrazená → daná routa se nemá objevovat ve výsledcích vyhledávačů
// (SPA: Google renderuje JS, takže meta uvidí). „follow" = odkazy sledovat smí.
export function useNoindex() {
  useEffect(() => {
    const m = document.createElement('meta')
    m.name = 'robots'
    m.content = 'noindex, follow'
    document.head.appendChild(m)
    return () => { document.head.removeChild(m) }
  }, [])
}
