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
        model: 'gpt-4o',
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

    // sanitizace — přijmi i číslo zapsané jako text ("49.25")
    const num = (v: any) => {
      const n = typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v.replace(',', '.')) : NaN)
      return isFinite(n) ? n : null
    }

    // ── GPS: model určí KONKRÉTNÍ místo/budovu → geokóduje se přes Nominatim (OSM) ──
    // Nejpřesnější je reálný geokódovací rejstřík; odhad modelu slouží jen jako záloha.
    let lat = num(parsed.lat)
    let lng = num(parsed.lng)
    let place: string | null = null
    let placeQuery: string | null = null
    try {
      const gpsRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4.1',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Jsi expert na historickou geografii. Urči PŘESNÉ fyzické místo, kde se událost odehrála (konkrétní budova/památník/náměstí, ne jen město). Pokud místo neznáš jistě, vrať null. Souřadnice jako desetinná čísla s tečkou.' },
            { role: 'user', content: `Událost: "${title}"${year != null && year !== '' ? `, rok: ${year}` : ''}.\nVrať JSON:\n{\n  "place": "<lidský popis místa, např. 'Lycée Roosevelt, Remeš, Francie'>",\n  "geocode_query": "<co nejpřesnější vyhledávací dotaz pro OpenStreetMap: budova/ulice + město + země, anglicky nebo místním jazykem>",\n  "lat": <číslo nebo null>,\n  "lng": <číslo nebo null>\n}` },
          ],
        }),
      })
      if (gpsRes.ok) {
        const gd = await gpsRes.json()
        const gp = JSON.parse(gd?.choices?.[0]?.message?.content || '{}')
        const glat = num(gp.lat), glng = num(gp.lng)
        if (glat != null && glng != null) { lat = glat; lng = glng }
        if (typeof gp.place === 'string') place = gp.place
        if (typeof gp.geocode_query === 'string') placeQuery = gp.geocode_query
      }
    } catch { /* fallback na lat/lng z hlavního volání */ }

    // Geokódování konkrétního místa přes Nominatim → přesné souřadnice budovy
    if (placeQuery) {
      try {
        const gq = encodeURIComponent(placeQuery)
        const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${gq}&format=json&limit=1&addressdetails=0`, {
          headers: { 'User-Agent': 'HistoryGuessr/1.0 (admin event geocoding)' },
        })
        if (nomRes.ok) {
          const hits = await nomRes.json()
          const hit = Array.isArray(hits) ? hits[0] : null
          const nlat = num(hit?.lat), nlng = num(hit?.lon)
          if (nlat != null && nlng != null) {
            // Geokóder má přednost jen když je „blízko" odhadu modelu (do ~50 km) —
            // chrání před tím, aby vyhledávač trefil stejnojmenné místo jinde ve světě.
            const near = lat == null || lng == null ||
              (Math.abs(nlat - lat) < 0.5 && Math.abs(nlng - lng) < 0.5)
            if (near) { lat = nlat; lng = nlng }
          }
        }
      } catch { /* ponech souřadnice z modelu */ }
    }

    // validace rozsahu — mimo rozsah = neplatné
    if (lat == null || lat < -90 || lat > 90) lat = null
    if (lng == null || lng < -180 || lng > 180) lng = null
    if (lat == null || lng == null) { lat = null; lng = null }

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
      lat,
      lng,
      category: CATEGORIES.includes(parsed.category) ? parsed.category : null,
      note: [place ? `📍 ${place}` : null, typeof parsed.note === 'string' ? parsed.note : null].filter(Boolean).join(' · ') || null,
    }
    res.status(200).json(out)
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', detail: String(e?.message || e) })
  }
}
