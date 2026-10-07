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
    let code = '', detail = ''
    try { const j = await res.json(); code = j.error || ''; detail = j.detail || '' } catch { /* ignore */ }
    if (res.status === 403 && code === 'not_friends') throw new Error('S tímto hráčem nejste přátelé.')
    if (res.status === 500 && code === 'missing_vapid') throw new Error('Push není nastavený (chybí VAPID klíče na serveru).')
    if (res.status === 500 && code === 'missing_supabase_env') throw new Error('Na serveru chybí SUPABASE_SERVICE_ROLE_KEY.')
    throw new Error(`Posla se nepodařilo poslat (${res.status}). ${[code, detail].filter(Boolean).join(' — ')}`)
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

/** Kteří přátelé mají zapnuté notifikace (appka na ploše + povolené noti) —
 *  jen jim má smysl posílat posla. */
export async function getFriendsWithPush(): Promise<Set<string>> {
  const { data } = await supabase.rpc('friends_push_enabled')
  const ids = (data as Array<string | { friends_push_enabled: string }> | null) ?? []
  const out = new Set<string>()
  for (const r of ids) out.add(typeof r === 'string' ? r : r.friends_push_enabled)
  return out
}

export interface AppNotification {
  senderId: string
  username: string | null
  day: string
  senderScore: number | null
  createdAt: string
}

/** Notifikační centrum: poslové + skóre odesílatele v ten den (nejnovější první). */
export async function getNotifications(): Promise<AppNotification[]> {
  const { data } = await supabase.rpc('my_notifications')
  return ((data ?? []) as Array<{ sender_id: string; username: string | null; day: string; sender_score: number | null; created_at: string }>)
    .map(r => ({ senderId: r.sender_id, username: r.username, day: r.day, senderScore: r.sender_score, createdAt: r.created_at }))
}

// Kdy jsem naposledy viděl notifikace (pro odznak „nepřečtené") — per zařízení.
const NOTIF_SEEN_KEY = 'hg_notif_seen_at'
export function getNotifSeenAt(): number {
  try { return Number(localStorage.getItem(NOTIF_SEEN_KEY) || 0) } catch { return 0 }
}
export function markNotifSeen(): void {
  try { localStorage.setItem(NOTIF_SEEN_KEY, String(Date.now())) } catch { /* ignore */ }
}
/** Počet nepřečtených (novějších než poslední zobrazení). */
export function unreadCount(list: AppNotification[]): number {
  const seen = getNotifSeenAt()
  return list.filter(n => new Date(n.createdAt).getTime() > seen).length
}
