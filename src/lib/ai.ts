import { supabase } from './supabase'

export type AiEventDraft = {
  title_cs: string | null
  title_en: string | null
  title_de: string | null
  description_cs: string | null
  description_en: string | null
  description_de: string | null
  event_date: string | null
  year_from: number | null
  year_to: number | null
  lat: number | null
  lng: number | null
  category: string | null
  note: string | null
}

/** Zavolá serverovou funkci /api/generate-event (OpenAI), vrátí draft pro EventForm. */
export async function generateEventDraft(title: string, year: string | number): Promise<AiEventDraft> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Nejsi přihlášený.')

  const res = await fetch('/api/generate-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title, year }),
  })

  if (!res.ok) {
    let detail = ''
    try { const j = await res.json(); detail = j.detail || j.error || '' } catch { /* ignore */ }
    if (res.status === 403) throw new Error('Přístup jen pro administrátory.')
    if (res.status === 500 && detail === 'missing_openai_key') throw new Error('Na serveru chybí OPENAI_API_KEY.')
    throw new Error(`Generování selhalo (${res.status}). ${detail}`)
  }
  return res.json()
}
