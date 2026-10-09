// Vercel serverless funkce — „Poslat posla": přihlášený hráč pošle příteli,
// který dnes ještě nehrál denní výzvu, push notifikaci s pozvánkou.
// Rate-limit 1× denně na příjemce (UNIQUE sender+target+day v messenger_nudges).
//
// ENV (Vercel):
//   VAPID_PUBLIC_KEY (nebo VITE_VAPID_PUBLIC_KEY), VAPID_PRIVATE_KEY, VAPID_SUBJECT
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
import webpush from 'web-push'

export const config = { maxDuration: 30 }

const DAY_MS = 86400000

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return }

  const SUPA = process.env.VITE_SUPABASE_URL
  const ANON = process.env.VITE_SUPABASE_ANON_KEY
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
  const VAPID_PUB = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
  const VAPID_PRIV = process.env.VAPID_PRIVATE_KEY
  const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@historyguesser.net'
  if (!SUPA || !ANON || !SERVICE) { res.status(500).json({ error: 'missing_supabase_env' }); return }
  if (!VAPID_PUB || !VAPID_PRIV) { res.status(500).json({ error: 'missing_vapid' }); return }

  // ── Ověření volajícího ──
  let callerId = ''
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '')
    if (!token) { res.status(401).json({ error: 'unauthorized' }); return }
    const userRes = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } })
    if (!userRes.ok) { res.status(401).json({ error: 'unauthorized' }); return }
    callerId = (await userRes.json())?.id
    if (!callerId) { res.status(401).json({ error: 'unauthorized' }); return }
  } catch { res.status(401).json({ error: 'unauthorized' }); return }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const targetId = String(body.targetId || '').trim()
  if (!targetId) { res.status(400).json({ error: 'missing_target' }); return }
  if (targetId === callerId) { res.status(400).json({ error: 'self' }); return }

  const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }
  const today = new Date().toISOString().slice(0, 10)

  // ── Jsou to opravdu přátelé? (ochrana proti spamu cizím lidem) ──
  try {
    const fr = await fetch(`${SUPA}/rest/v1/friendships?select=id&status=eq.accepted&or=(and(requester_id.eq.${callerId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${callerId}))&limit=1`, { headers: svc })
    if (fr.ok) {
      const rows = await fr.json()
      if (!Array.isArray(rows) || rows.length === 0) { res.status(403).json({ error: 'not_friends' }); return }
    }
  } catch { /* když dotaz nevyjde, radši pokračuj než blokuj posla */ }

  // ── Rate-limit: vlož nudge; konflikt = už dnes posláno ──
  try {
    const ins = await fetch(`${SUPA}/rest/v1/messenger_nudges`, {
      method: 'POST', headers: { ...svc, Prefer: 'return=minimal' },
      body: JSON.stringify({ sender_id: callerId, target_id: targetId, day: today }),
    })
    if (ins.status === 409) { res.status(200).json({ sent: false, already: true }); return }
    if (!ins.ok && ins.status !== 201) { res.status(500).json({ error: 'nudge_insert_failed', detail: (await ins.text()).slice(0, 200) }); return }
  } catch (e: any) { res.status(500).json({ error: 'nudge_insert_failed', detail: String(e?.message || e) }); return }

  // ── Příjemce odběry ──
  let subs: Array<{ endpoint: string; p256dh: string; auth: string }> = []
  try {
    const r = await fetch(`${SUPA}/rest/v1/push_subscriptions?user_id=eq.${targetId}&select=endpoint,p256dh,auth`, { headers: svc })
    if (r.ok) subs = await r.json()
  } catch { /* bez odběrů */ }
  if (!subs.length) { res.status(200).json({ sent: false, no_subscription: true }); return }

  // ── Jméno + dnešní skóre odesílatele (ze serveru, neduvěřuj klientovi) ──
  let senderName = 'Někdo'
  let senderScore: number | null = null
  try {
    const pr = await fetch(`${SUPA}/rest/v1/profiles?id=eq.${callerId}&select=username`, { headers: svc })
    if (pr.ok) { const p = await pr.json(); senderName = p?.[0]?.username || senderName }
    const sr = await fetch(`${SUPA}/rest/v1/daily_results?user_id=eq.${callerId}&date=eq.${today}&select=score`, { headers: svc })
    if (sr.ok) { const s = await sr.json(); if (Array.isArray(s) && s[0]) senderScore = s[0].score }
  } catch { /* best-effort */ }

  // ── Série příjemce (po sobě jdoucí dny do dneška/včerejška) ──
  let targetStreak = 0
  try {
    const dr = await fetch(`${SUPA}/rest/v1/daily_results?user_id=eq.${targetId}&select=date&order=date.desc&limit=400`, { headers: svc })
    if (dr.ok) {
      const rows = await dr.json() as Array<{ date: string }>
      const days = new Set((rows || []).map(r => r.date))
      const todayMs = Date.parse(today + 'T00:00:00Z')
      // série platí, pokud hráč hrál dnes nebo včera; počítáme zpět
      let cursor = days.has(today) ? todayMs : (days.has(new Date(todayMs - DAY_MS).toISOString().slice(0, 10)) ? todayMs - DAY_MS : -1)
      while (cursor >= 0 && days.has(new Date(cursor).toISOString().slice(0, 10))) { targetStreak++; cursor -= DAY_MS }
    }
  } catch { /* série volitelná */ }

  // ── Zpráva ──
  const title = `${senderName} ti posílá posla`
  const scorePart = senderScore != null ? `${senderName} dal ${senderScore} bodů. ` : ''
  const streakPart = targetStreak > 0 ? `Tvá série ${targetStreak} ${pluralDays(targetStreak)} skončí o půlnoci.` : ''
  const bodyText = `Dnešní výzva čeká — ${scorePart}${streakPart}`.trim()
  const payload = JSON.stringify({
    title, body: bodyText, url: '/daily', tag: 'daily-messenger',
    icon: '/icon-192.png', badge: '/icon-192.png',
  })

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUB, VAPID_PRIV)
  } catch (e: any) {
    res.status(500).json({ error: 'vapid_setup_failed', detail: String(e?.message || e) }); return
  }
  let delivered = 0
  const dead: string[] = []
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
      delivered++
    } catch (e: any) {
      const code = e?.statusCode
      if (code === 404 || code === 410) dead.push(s.endpoint)   // odběr zmizel
    }
  }))
  // úklid mrtvých odběrů
  if (dead.length) {
    const inList = dead.map(e => `"${e.replace(/"/g, '%22')}"`).join(',')
    try { await fetch(`${SUPA}/rest/v1/push_subscriptions?endpoint=in.(${inList})`, { method: 'DELETE', headers: svc }) } catch { /* ignore */ }
  }

  res.status(200).json({ sent: delivered > 0, delivered })
}

function pluralDays(n: number): string {
  if (n === 1) return 'den'
  if (n >= 2 && n <= 4) return 'dny'
  return 'dní'
}
