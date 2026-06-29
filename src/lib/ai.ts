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

export type EventSuggestion = {
  title: string
  year: number | null
  country: string | null
  category: string | null
  series: string | null
  reason: string | null
}

/** Navrhne N nových událostí podle mezer v pokrytí (server analyzuje existující). */
export async function suggestEvents(count: number): Promise<EventSuggestion[]> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Nejsi přihlášený.')

  const res = await fetch('/api/suggest-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ count }),
  })
  if (!res.ok) {
    let detail = ''
    try { const j = await res.json(); detail = j.detail || j.error || '' } catch { /* ignore */ }
    if (res.status === 403) throw new Error('Přístup jen pro administrátory.')
    if (res.status === 500 && detail === 'missing_openai_key') throw new Error('Na serveru chybí OPENAI_API_KEY.')
    throw new Error(`Návrh událostí selhal (${res.status}). ${detail}`)
  }
  const { events } = await res.json() as { events: EventSuggestion[] }
  return events
}

export type PanoramaParams = {
  title: string
  event_date?: string
  period?: string
  location?: string
  description?: string
  model?: 'gpt-image-1' | 'gpt-image-2'
}

/** Zavolá /api/generate-panorama, vrátí PNG jako File pro upload pipeline. */
export async function generatePanorama(params: PanoramaParams): Promise<File> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Nejsi přihlášený.')

  const res = await fetch('/api/generate-panorama', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    let detail = ''
    try { const j = await res.json(); detail = j.detail || j.error || '' } catch { /* ignore */ }
    if (res.status === 403) throw new Error('Přístup jen pro administrátory.')
    if (res.status === 500 && detail === 'missing_openai_key') throw new Error('Na serveru chybí OPENAI_API_KEY.')
    if (res.status === 504) throw new Error('Generování trvalo příliš dlouho (timeout). Zkus to znovu nebo nižší kvalitu.')
    throw new Error(`Generování panoramatu selhalo (${res.status}). ${detail}`)
  }
  const { image } = await res.json() as { image: string }
  // Pozor: NEPOUŽÍVAT fetch(dataURL) — Safari má limit na velikost data: URL
  // a u velkého obrázku spadne s „Load failed". Dekódujeme base64 ručně.
  const comma = image.indexOf(',')
  const meta = image.slice(0, comma)
  const b64 = image.slice(comma + 1)
  const mime = /data:(.*?);/.exec(meta)?.[1] || 'image/png'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const blob = new Blob([bytes], { type: mime })
  const ext = mime === 'image/webp' ? 'webp' : (mime === 'image/jpeg' ? 'jpg' : 'png')
  return new File([blob], `ai-panorama.${ext}`, { type: mime })
}
