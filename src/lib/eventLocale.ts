import i18n from '@/i18n'
import type { Event } from '@/types/database'

// Lokalizovaný název/popis události podle aktuálního jazyka.
// Základní (české) sloupce title/description jsou fallback, když chybí překlad.
type EventLike = Pick<Event, 'title' | 'description'> & Partial<
  Pick<Event, 'title_en' | 'title_de' | 'description_en' | 'description_de'>
>

export function eventTitle(ev: EventLike): string {
  const lng = (i18n.language || 'cs').slice(0, 2)
  if (lng === 'en') return ev.title_en?.trim() || ev.title
  if (lng === 'de') return ev.title_de?.trim() || ev.title
  return ev.title
}

export function eventDescription(ev: EventLike): string {
  const lng = (i18n.language || 'cs').slice(0, 2)
  if (lng === 'en') return ev.description_en?.trim() || ev.description
  if (lng === 'de') return ev.description_de?.trim() || ev.description
  return ev.description
}

// Lokalizovaný název/popis odměny z kampaně (relikvie). Stejný princip: CZ fallback.
type RewardLike = { name: string; name_en?: string | null; name_de?: string | null
  description?: string | null; description_en?: string | null; description_de?: string | null }

export function rewardName(r: RewardLike): string {
  const lng = (i18n.language || 'cs').slice(0, 2)
  if (lng === 'en') return r.name_en?.trim() || r.name
  if (lng === 'de') return r.name_de?.trim() || r.name
  return r.name
}

export function rewardDescription(r: RewardLike): string {
  const lng = (i18n.language || 'cs').slice(0, 2)
  if (lng === 'en') return r.description_en?.trim() || r.description || ''
  if (lng === 'de') return r.description_de?.trim() || r.description || ''
  return r.description || ''
}

// Obecná lokalizace pro cokoli s title/description + _en/_de (kampaně, kategorie).
// Event má vlastní eventTitle/eventDescription (description je u něj non-null).
type TitleLike = { title: string; title_en?: string | null; title_de?: string | null }
type DescLike = { description?: string | null; description_en?: string | null; description_de?: string | null }

export function localizedTitle(o: TitleLike): string {
  const lng = (i18n.language || 'cs').slice(0, 2)
  if (lng === 'en') return o.title_en?.trim() || o.title
  if (lng === 'de') return o.title_de?.trim() || o.title
  return o.title
}

export function localizedDescription(o: DescLike): string {
  const lng = (i18n.language || 'cs').slice(0, 2)
  if (lng === 'en') return o.description_en?.trim() || o.description || ''
  if (lng === 'de') return o.description_de?.trim() || o.description || ''
  return o.description || ''
}
