// Supabase Edge Function: večerní připomínka denní výzvy + „série v ohrožení".
// Spouští ji pg_cron (viz supabase/functions/send-daily-reminders/CRON.sql).
//
// Pošle push jen hráčům, kteří:
//   • mají uložený push odběr, a
//   • dnes ještě nehráli denní výzvu.
// Pokud hráli VČERA (běžící série), dostanou variantu „série v ohrožení".
//
// ENV (Supabase → Project Settings → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…)
//   SUPABASE_URL a SUPABASE_SERVICE_ROLE_KEY jsou k dispozici automaticky.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SB_URL = Deno.env.get('SUPABASE_URL')!
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@historyguesser.net'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

// Datum v Evropě/Praze jako YYYY-MM-DD (daily_results.date je lokální den).
function pragueDateISO(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86400000)
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' })
  return fmt.format(now) // en-CA → YYYY-MM-DD
}

Deno.serve(async () => {
  const sb = createClient(SB_URL, SB_SERVICE)
  const today = pragueDateISO(0)
  const yesterday = pragueDateISO(-1)

  const [{ data: subs }, { data: playedTodayRows }, { data: playedYdayRows }] = await Promise.all([
    sb.from('push_subscriptions').select('user_id, endpoint, p256dh, auth'),
    sb.from('daily_results').select('user_id').eq('date', today),
    sb.from('daily_results').select('user_id').eq('date', yesterday),
  ])

  const playedToday = new Set((playedTodayRows ?? []).map((r: { user_id: string }) => r.user_id))
  const playedYday = new Set((playedYdayRows ?? []).map((r: { user_id: string }) => r.user_id))

  const REMINDER = { title: 'Denní výzva čeká', body: 'Zvládneš dnešní „Tento den v historii"? 🏛️', url: '/daily', tag: 'daily-reminder' }
  const STREAK = { title: 'Tvoje série je v ohrožení 🔥', body: 'Zahraj dnešní denní výzvu, ať ti série nespadne!', url: '/daily', tag: 'daily-reminder' }

  let sent = 0, removed = 0
  const jobs = (subs ?? [])
    .filter((s: { user_id: string }) => !playedToday.has(s.user_id))
    .map(async (s: { user_id: string; endpoint: string; p256dh: string; auth: string }) => {
      const payload = JSON.stringify(playedYday.has(s.user_id) ? STREAK : REMINDER)
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) { // odběr zanikl → ukliď
          await sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          removed++
        }
      }
    })
  await Promise.all(jobs)

  return new Response(JSON.stringify({ ok: true, date: today, candidates: jobs.length, sent, removed }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
