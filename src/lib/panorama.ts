// Výchozí hfov (horizontální zorné pole) panoramatu.
// Na desktopu širší záběr (méně „přiblížené"), na mobilu ponecháváme 140,
// protože na výšku by ještě širší hfov působil jako rybí oko.
export function panoramaHfov(): number {
  if (typeof window !== 'undefined' && window.innerWidth >= 900) return 150
  return 140
}
