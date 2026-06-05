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
