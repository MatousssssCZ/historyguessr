// Jediný zdroj pravdy pro veřejné (Explore) URL: jazyky, slugy kategorií,
// stavba cest. Sdíleno herní appkou (odkazy „Objevit historii") i build-time
// SSG generátorem (scripts/build-explore-pages.mjs).

export const SITE_ORIGIN = 'https://historyguesser.net'

export type ExploreLocale = 'cs' | 'en' | 'de'
export const EXPLORE_LOCALES: ExploreLocale[] = ['cs', 'en', 'de']

/** Segmenty cest podle jazyka (lokalizované, kvůli SEO). */
export const PATH_SEG: Record<ExploreLocale, { explore: string; events: string; campaigns: string }> = {
  cs: { explore: 'objevuj', events: 'udalosti', campaigns: 'kampane' },
  en: { explore: 'explore', events: 'events', campaigns: 'campaigns' },
  de: { explore: 'entdecken', events: 'ereignisse', campaigns: 'kampagnen' },
}

/** Klíče kategorií tak, jak je ukládá DB (events.category). */
export type CategoryKey =
  | 'war' | 'moments' | 'places' | 'inventions'
  | 'art' | 'sports' | 'mysteries' | 'disasters'

export const CATEGORY_KEYS: CategoryKey[] = [
  'war', 'moments', 'places', 'inventions', 'art', 'sports', 'mysteries', 'disasters',
]

/** Lokalizovaný název + URL slug kategorie. Slug je součást veřejné URL, tedy stabilní. */
export const CATEGORIES: Record<CategoryKey, Record<ExploreLocale, { label: string; slug: string }>> = {
  war: {
    cs: { label: 'Války a bitvy', slug: 'valky-a-bitvy' },
    en: { label: 'Wars & Battles', slug: 'wars-and-battles' },
    de: { label: 'Kriege & Schlachten', slug: 'kriege-und-schlachten' },
  },
  moments: {
    cs: { label: 'Historické okamžiky', slug: 'historicke-okamziky' },
    en: { label: 'Historic Moments', slug: 'historic-moments' },
    de: { label: 'Historische Momente', slug: 'historische-momente' },
  },
  places: {
    cs: { label: 'Objevy míst', slug: 'objevy-mist' },
    en: { label: 'Discoveries of Places', slug: 'discoveries-of-places' },
    de: { label: 'Entdeckungen von Orten', slug: 'entdeckungen-von-orten' },
  },
  inventions: {
    cs: { label: 'Vynálezy', slug: 'vynalezy' },
    en: { label: 'Inventions', slug: 'inventions' },
    de: { label: 'Erfindungen', slug: 'erfindungen' },
  },
  art: {
    cs: { label: 'Umění a kultura', slug: 'umeni-a-kultura' },
    en: { label: 'Art & Culture', slug: 'art-and-culture' },
    de: { label: 'Kunst & Kultur', slug: 'kunst-und-kultur' },
  },
  sports: {
    cs: { label: 'Sport', slug: 'sport' },
    en: { label: 'Sports', slug: 'sports' },
    de: { label: 'Sport', slug: 'sport' },
  },
  mysteries: {
    cs: { label: 'Záhady', slug: 'zahady' },
    en: { label: 'Mysteries', slug: 'mysteries' },
    de: { label: 'Rätsel', slug: 'raetsel' },
  },
  disasters: {
    cs: { label: 'Katastrofy', slug: 'katastrofy' },
    en: { label: 'Disasters', slug: 'katastrophen' },
    de: { label: 'Katastrophen', slug: 'katastrophen' },
  },
}

export function isCategoryKey(v: string | null | undefined): v is CategoryKey {
  return !!v && (CATEGORY_KEYS as string[]).includes(v)
}

/** category slug → klíč (pro daný jazyk); pro routing z URL zpět na data. */
export function categoryKeyFromSlug(slug: string, locale: ExploreLocale): CategoryKey | null {
  for (const key of CATEGORY_KEYS) {
    if (CATEGORIES[key][locale].slug === slug) return key
  }
  return null
}

// ── Stavba cest (relativní, začínají „/") ──────────────────────────────────
export const exploreListPath = (l: ExploreLocale) => `/${l}/${PATH_SEG[l].explore}`
export const categoryPath = (l: ExploreLocale, key: CategoryKey) =>
  `/${l}/${PATH_SEG[l].explore}/${CATEGORIES[key][l].slug}`
export const eventPath = (l: ExploreLocale, slug: string) => `/${l}/${PATH_SEG[l].events}/${slug}`
export const campaignPath = (l: ExploreLocale, slug: string) => `/${l}/${PATH_SEG[l].campaigns}/${slug}`

/** Absolutní URL (pro canonical, hreflang, sitemap, og:url). */
export const abs = (path: string) => `${SITE_ORIGIN}${path}`

/** Hluboký odkaz z obsahové stránky do herní SPA na konkrétní událost. */
export const playEventPath = (eventId: string) => `/play?event=${encodeURIComponent(eventId)}`
