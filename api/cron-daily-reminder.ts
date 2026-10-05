// Vercel Cron — večerní připomínka denní výzvy (cca 19:00 Praha).
// Pošle push hráčům, kteří: mají push odběr, dnes NEodehráli denní výzvu,
// NEdostali dnes posla a ještě jim dnes připomínka nešla.
//
// Zabezpečení: Vercel cron posílá `Authorization: Bearer $CRON_SECRET`.
// ENV: CRON_SECRET, VAPID_PUBLIC_KEY (/VITE_), VAPID_PRIVATE_KEY, VAPID_SUBJECT,
//      VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import webpush from 'web-push'

export const config = { maxDuration: 60 }

export default async function handler(req: any, res: any) {
  const SUPA = process.env.VITE_SUPABASE_URL
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
  const VAPID_PUB = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
  const VAPID_PRIV = process.env.VAPID_PRIVATE_KEY
  const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@historyguesser.net'
  const CRON_SECRET = process.env.CRON_SECRET

  // Autorizace cronu
  const auth = String(req.headers.authorization || '')
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) { res.status(401).json({ error: 'unauthorized' }); return }
  if (!SUPA || !SERVICE) { res.status(500).json({ error: 'missing_supabase_env' }); return }
  if (!VAPID_PUB || !VAPID_PRIV) { res.status(500).json({ error: 'missing_vapid' }); return }

  const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }

  // Komu poslat (RPC filtruje odehrané/posly/už připomenuté)
  let rows: Array<{ user_id: string; endpoint: string; p256dh: string; auth: string }> = []
  try {
    const r = await fetch(`${SUPA}/rest/v1/rpc/users_needing_daily_reminder`, { method: 'POST', headers: svc, body: '{}' })
    if (!r.ok) { res.status(502).json({ error: 'rpc_failed', detail: (await r.text()).slice(0, 200) }); return }
    rows = await r.json()
  } catch (e: any) { res.status(500).json({ error: 'rpc_error', detail: String(e?.message || e) }); return }

  if (!rows.length) { res.status(200).json({ sent: 0, note: 'nikdo k připomenutí' }); return }

  const payload = JSON.stringify({
    title: 'Dnešní výzva čeká ⏳',
    body: 'Ještě jsi dnes nehrál denní výzvu. Skoč do historie a udrž si sérii — do půlnoci je čas!',
    url: '/daily', tag: 'daily-reminder', icon: '/icon-192.png', badge: '/icon-192.png',
  })
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUB, VAPID_PRIV)

  const dead: string[] = []
  const notifiedUsers = new Set<string>()
  let delivered = 0
  await Promise.all(rows.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
      delivered++; notifiedUsers.add(s.user_id)
    } catch (e: any) {
      const code = e?.statusCode
      if (code === 404 || code === 410) dead.push(s.endpoint)
      else notifiedUsers.add(s.user_id)   // odesláno/pokus proběhl — neopakovat dnes
    }
  }))

  // Log odeslání (idempotence — den dopočítá default v tabulce)
  if (notifiedUsers.size) {
    try {
      await fetch(`${SUPA}/rest/v1/daily_reminder_log`, {
        method: 'POST', headers: { ...svc, Prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify([...notifiedUsers].map(u => ({ user_id: u }))),
      })
    } catch { /* ignore */ }
  }
  // Úklid mrtvých odběrů
  if (dead.length) {
    const inList = dead.map(e => `"${e.replace(/"/g, '%22')}"`).join(',')
    try { await fetch(`${SUPA}/rest/v1/push_subscriptions?endpoint=in.(${inList})`, { method: 'DELETE', headers: svc }) } catch { /* ignore */ }
  }

  res.status(200).json({ candidates: rows.length, delivered, users: notifiedUsers.size })
}
