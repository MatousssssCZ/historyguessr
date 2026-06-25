// Vercel serverless funkce — vygeneruje data události přes OpenAI.
// Klíč zůstává na serveru (env OPENAI_API_KEY). Volá jen admin (ověření přes Supabase).
//
// ENV (Vercel): OPENAI_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

const CATEGORIES = ['war', 'moments', 'places', 'inventions', 'art', 'sports', 'mysteries', 'disasters']

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return }

  const SUPA = process.env.VITE_SUPABASE_URL
  const ANON = process.env.VITE_SUPABASE_ANON_KEY
  const OPENAI_KEY = process.env.OPENAI_API_KEY
  if (!OPENAI_KEY) { res.status(500).json({ error: 'missing_openai_key' }); return }

  // ── Ověření, že volá admin ──────────────────────────────
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '')
    if (!token || !SUPA || !ANON) { res.status(401).json({ error: 'unauthorized' }); return }
    const userRes = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } })
    if (!userRes.ok) { res.status(401).json({ error: 'unauthorized' }); return }
    const user = await userRes.json()
    const profRes = await fetch(`${SUPA}/rest/v1/profiles?id=eq.${user.id}&select=role`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } })
    const prof = await profRes.json()
    if (!Array.isArray(prof) || prof[0]?.role !== 'admin') { res.status(403).json({ error: 'forbidden' }); return }
  } catch {
    res.status(401).json({ error: 'unauthorized' }); return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const title = String(body.title || '').trim()
  const year = body.year
  if (!title) { res.status(400).json({ error: 'missing_title' }); return }

  const sys = `Jsi pečlivý asistent pro historii a zeměpis. Z názvu události a roku vrať PŘESNÁ strukturovaná data jako JSON. ` +
    `Pokud si nějakým polem nejsi jistý, vrať null (nehádej souřadnice ani datum). ` +
    `Souřadnice = skutečné místo události. ` +
    `Popisy piš populárně-naučným stylem (čtivě, poutavě, ale fakticky přesně), každý popis cca 80 slov, bez markdownu. ` +
    `event_date jen pro n. l. (formát YYYY-MM-DD); pokud je rok př. n. l. nebo datum neznámé, vrať null. ` +
    `year_from/year_to celá čísla (záporná = př. n. l.); u přesné události oba stejné, u nejisté/víceleté rozsah. ` +
    `category jedno z: ${CATEGORIES.join(', ')} nebo null.`

  const userMsg = `Událost: "${title}"${year != null && year !== '' ? `, přibližný rok: ${year}` : ''}.\n` +
    `Vrať JSON s klíči: title_cs, title_en, title_de, description_cs, description_en, description_de, ` +
    `event_date, year_from, year_to, lat, lng, category, note (krátká poznámka česky o zdroji/jistotě).`

  try {
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userMsg },
        ],
      }),
    })
    if (!aiRes.ok) {
      const txt = await aiRes.text()
      res.status(502).json({ error: 'openai_error', detail: txt.slice(0, 400) }); return
    }
    const data = await aiRes.json()
    const content = data?.choices?.[0]?.message?.content || '{}'
    let parsed: any
    try { parsed = JSON.parse(content) } catch { res.status(502).json({ error: 'bad_json' }); return }

    // sanitizace
    const num = (v: any) => (typeof v === 'number' && isFinite(v) ? v : null)
    const out = {
      title_cs: parsed.title_cs ?? title,
      title_en: parsed.title_en ?? null,
      title_de: parsed.title_de ?? null,
      description_cs: parsed.description_cs ?? null,
      description_en: parsed.description_en ?? null,
      description_de: parsed.description_de ?? null,
      event_date: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.event_date)) ? parsed.event_date : null,
      year_from: Number.isInteger(parsed.year_from) ? parsed.year_from : (num(parsed.year_from) != null ? Math.round(parsed.year_from) : null),
      year_to: Number.isInteger(parsed.year_to) ? parsed.year_to : (num(parsed.year_to) != null ? Math.round(parsed.year_to) : null),
      lat: num(parsed.lat),
      lng: num(parsed.lng),
      category: CATEGORIES.includes(parsed.category) ? parsed.category : null,
      note: typeof parsed.note === 'string' ? parsed.note : null,
    }
    res.status(200).json(out)
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', detail: String(e?.message || e) })
  }
}
