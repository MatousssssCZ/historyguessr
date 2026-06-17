// Achievementy podle kategorie. Postup = počet kol se skóre >= 950
// v dané kategorii (počítá server, viz migrace 019).
// Názvy jsou záměrně jen česky (zadání); lze později lokalizovat.

export interface Tier { count: number; icon: string; name: string }
export interface CategoryAchievements { id: string; icon: string; label: string; tiers: Tier[] }

export const ACHIEVEMENTS: CategoryAchievements[] = [
  {
    id: 'war', icon: '⚔️', label: 'Války a bitvy',
    tiers: [
      { count: 1, icon: '🪖', name: 'Branec' },
      { count: 3, icon: '🎖️', name: 'Vojín' },
      { count: 5, icon: '🛡️', name: 'Veterán' },
      { count: 10, icon: '⚔️', name: 'Důstojník' },
      { count: 20, icon: '🐎', name: 'Plukovník' },
      { count: 30, icon: '🏰', name: 'Generál' },
      { count: 40, icon: '👑', name: 'Vojevůdce' },
      { count: 50, icon: '🔥', name: 'Mistr bitev' },
    ],
  },
  {
    id: 'moments', icon: '📜', label: 'Historické okamžiky',
    tiers: [
      { count: 1, icon: '✒️', name: 'Svědek dějin' },
      { count: 3, icon: '📖', name: 'Zapisovatel' },
      { count: 5, icon: '📜', name: 'Kronikář' },
      { count: 10, icon: '🏛️', name: 'Historik' },
      { count: 20, icon: '🗄️', name: 'Archivář' },
      { count: 30, icon: '🎓', name: 'Učenec' },
      { count: 40, icon: '🕰️', name: 'Strážce dějin' },
      { count: 50, icon: '👑', name: 'Pán historie' },
    ],
  },
  {
    id: 'places', icon: '🧭', label: 'Objevy míst',
    tiers: [
      { count: 1, icon: '🥾', name: 'Cestovatel' },
      { count: 3, icon: '🧭', name: 'Průzkumník' },
      { count: 5, icon: '🗺️', name: 'Objevitel' },
      { count: 10, icon: '📍', name: 'Kartograf' },
      { count: 20, icon: '⛵', name: 'Navigátor' },
      { count: 30, icon: '🌍', name: 'Zeměpisec' },
      { count: 40, icon: '🗿', name: 'Velký objevitel' },
      { count: 50, icon: '🌎', name: 'Mistr světa' },
    ],
  },
  {
    id: 'inventions', icon: '⚙️', label: 'Vynálezy',
    tiers: [
      { count: 1, icon: '🔩', name: 'Učeň' },
      { count: 3, icon: '🔧', name: 'Mechanik' },
      { count: 5, icon: '⚙️', name: 'Vynálezce' },
      { count: 10, icon: '🛠️', name: 'Inženýr' },
      { count: 20, icon: '🏗️', name: 'Konstruktér' },
      { count: 30, icon: '💡', name: 'Vizionář' },
      { count: 40, icon: '🧠', name: 'Génius' },
      { count: 50, icon: '🚀', name: 'Mistr inovací' },
    ],
  },
  {
    id: 'art', icon: '🎨', label: 'Umění',
    tiers: [
      { count: 1, icon: '🖌️', name: 'Návštěvník galerie' },
      { count: 3, icon: '🖼️', name: 'Obdivovatel' },
      { count: 5, icon: '🎭', name: 'Znalec' },
      { count: 10, icon: '🎨', name: 'Kurátor' },
      { count: 20, icon: '🏺', name: 'Mecenáš' },
      { count: 30, icon: '🏛️', name: 'Historik umění' },
      { count: 40, icon: '✨', name: 'Mistr galerie' },
      { count: 50, icon: '👑', name: 'Velmistr umění' },
    ],
  },
  {
    id: 'sports', icon: '🏅', label: 'Sportovní okamžiky',
    tiers: [
      { count: 1, icon: '👟', name: 'Fanoušek' },
      { count: 3, icon: '🏃', name: 'Sportovec' },
      { count: 5, icon: '🏅', name: 'Šampion' },
      { count: 10, icon: '🥉', name: 'Rekordman' },
      { count: 20, icon: '🥈', name: 'Olympionik' },
      { count: 30, icon: '🥇', name: 'Legenda stadionů' },
      { count: 40, icon: '🏆', name: 'Mistr sportu' },
      { count: 50, icon: '👑', name: 'Nesmrtelný šampion' },
    ],
  },
  {
    id: 'disasters', icon: '🌋', label: 'Katastrofy',
    tiers: [
      { count: 1, icon: '🌧️', name: 'Pozorovatel' },
      { count: 3, icon: '🚨', name: 'Záchranář' },
      { count: 5, icon: '🔍', name: 'Analytik' },
      { count: 10, icon: '📡', name: 'Dokumentarista' },
      { count: 20, icon: '⛑️', name: 'Krizový expert' },
      { count: 30, icon: '🌪️', name: 'Badatel katastrof' },
      { count: 40, icon: '🌋', name: 'Strážce historie' },
      { count: 50, icon: '☄️', name: 'Mistr katastrof' },
    ],
  },
  {
    id: 'mysteries', icon: '🔮', label: 'Záhady a legendy',
    tiers: [
      { count: 1, icon: '🕯️', name: 'Hledač stop' },
      { count: 3, icon: '🔍', name: 'Lovec záhad' },
      { count: 5, icon: '🗝️', name: 'Vyšetřovatel' },
      { count: 10, icon: '📚', name: 'Znalec legend' },
      { count: 20, icon: '🧿', name: 'Strážce tajemství' },
      { count: 30, icon: '🌙', name: 'Mystik' },
      { count: 40, icon: '🐉', name: 'Mistr záhad' },
      { count: 50, icon: '👑', name: 'Vládce legend' },
    ],
  },
]

/** Z počtu zásahů vrátí dosaženou a další úroveň. */
export function tierProgress(tiers: Tier[], hits: number) {
  let current: Tier | null = null
  let next: Tier | null = null
  for (const t of tiers) {
    if (hits >= t.count) current = t
    else { next = t; break }
  }
  return { current, next }
}
