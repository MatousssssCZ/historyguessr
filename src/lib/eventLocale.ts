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
