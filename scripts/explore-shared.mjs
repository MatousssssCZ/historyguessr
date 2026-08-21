// Sdílené konstanty a helpery pro build-explore-pages.mjs.
// ZRCADLÍ src/lib/slugify.ts a src/lib/exploreUrls.ts — držet v souladu.
// (Build skript je self-contained .mjs, stejně jako build-i18n-pages.mjs.)

export const SITE_ORIGIN = 'https://historyguesser.net'
export const LOCALES = ['cs', 'en', 'de']

export const PATH_SEG = {
  cs: { explore: 'objevuj', events: 'udalosti', campaigns: 'kampane' },
  en: { explore: 'explore', events: 'events', campaigns: 'campaigns' },
  de: { explore: 'entdecken', events: 'ereignisse', campaigns: 'kampagnen' },
}

export const CATEGORY_KEYS = ['war', 'moments', 'places', 'inventions', 'art', 'sports', 'mysteries', 'disasters']

export const CATEGORIES = {
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

const SPECIAL = { ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', đ: 'd', ð: 'd', þ: 'th', ł: 'l' }
export function slugify(input) {
  return (input || '')
    .toLowerCase()
    .replace(/[ßæœøđðþł]/g, (ch) => SPECIAL[ch] || ch)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

export const exploreListPath = (l) => `/${l}/${PATH_SEG[l].explore}`
export const categoryPath = (l, key) => `/${l}/${PATH_SEG[l].explore}/${CATEGORIES[key][l].slug}`
export const eventPath = (l, slug) => `/${l}/${PATH_SEG[l].events}/${slug}`
export const abs = (p) => `${SITE_ORIGIN}${p}`
export const playEventPath = (id) => `/play?event=${encodeURIComponent(id)}`

/** Slug události pro daný jazyk (perzistovaný sloupec, fallback na base slug). */
export function eventSlugFor(ev, locale) {
  if (locale === 'en') return ev.slug_en || ev.slug
  if (locale === 'de') return ev.slug_de || ev.slug
  return ev.slug
}

/** Lokalizovaný název události (fallback na CZ). */
export function eventTitleFor(ev, locale) {
  if (locale === 'en') return ev.title_en || ev.title
  if (locale === 'de') return ev.title_de || ev.title
  return ev.title
}

/** Lokalizovaný krátký popis (fallback na CZ). */
export function eventDescriptionFor(ev, locale) {
  if (locale === 'en') return ev.description_en || ev.description
  if (locale === 'de') return ev.description_de || ev.description
  return ev.description || ''
}

/** Delší čtenářský příběh {titulek, odstavce[]} pro jazyk, jinak null. */
export function eventStoryFor(ev, locale) {
  const s = locale === 'en' ? ev.story_en : locale === 'de' ? ev.story_de : ev.story_cs
  if (s && Array.isArray(s.odstavce) && s.odstavce.length) return s
  return null
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c])

/** Rok → čitelně (záporný = př. n. l.). */
export function formatYear(year, locale) {
  if (year == null) return ''
  const bc = { cs: 'př. n. l.', en: 'BC', de: 'v. Chr.' }[locale] || 'BC'
  return year < 0 ? `${Math.abs(year)} ${bc}` : String(year)
}
