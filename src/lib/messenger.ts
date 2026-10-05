// „Poslové" denní výzvy — pošli příteli, který dnes ještě nehrál, push notifikaci.
import { supabase } from './supabase'

export type MessengerResult =
  | { sent: true; delivered: number }
  | { sent: false; already?: boolean; no_subscription?: boolean }

/** Pošle posla (push) danému příteli. Server řeší rate-limit i vlastní odeslání. */
export async function sendMessenger(targetId: string): Promise<MessengerResult> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Nejsi přihlášený.')
  const res = await fetch('/api/send-messenger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ targetId }),
  })
  if (!res.ok) {
    let detail = ''
    try { const j = await res.json(); detail = j.error || j.detail || '' } catch { /* ignore */ }
    if (res.status === 403 && detail === 'not_friends') throw new Error('S tímto hráčem nejste přátelé.')
    if (res.status === 500 && detail === 'missing_vapid') throw new Error('Push není nastavený (chybí VAPID).')
    throw new Error(`Posla se nepodařilo poslat (${res.status}). ${detail}`)
  }
  return res.json()
}

/** Komu jsem dnes už posla poslal (pro stav tlačítka „Posel vyslán"). */
export async function getMessengersSentToday(): Promise<Set<string>> {
  const { data } = await supabase.rpc('messengers_sent_today')
  const ids = (data as Array<string | { messengers_sent_today: string }> | null) ?? []
  const out = new Set<string>()
  for (const r of ids) out.add(typeof r === 'string' ? r : r.messengers_sent_today)
  return out
}
