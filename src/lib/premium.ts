// Centrální data o Premium předplatném pro UI (cena + výčet výhod).
// Vlastní PRÁVA (co Free/Premium smí) žijí v entitlements.ts — tohle je jen
// prezentace pro obrazovku předplatného a CTA.

/** Měsíční cena Premium. Měň jen tady. */
export const PREMIUM_PRICE = { amount: 99, currency: 'Kč', period: 'month' as const }

/** Výhody Premium — klíč do i18n (premium.benefit.<key>) + ikona. */
export const PREMIUM_BENEFITS: { key: string; icon: string }[] = [
  { key: 'noAds', icon: '🚫' },
  { key: 'campaigns', icon: '🏛' },
  { key: 'smartFilters', icon: '🎯' },
  { key: 'exactEvents', icon: '📍' },
  { key: 'unlimitedExclude', icon: '♾️' },
  { key: 'continent', icon: '🌍' },
  { key: 'presets', icon: '💾' },
  // Roadmapa dočasně skrytá z Premium výčtu (pořeší se později) — feature i RPC zůstávají.
]
