// Vercel serverless funkce — navrhne N nových událostí podle mezer v pokrytí.
// Analyzuje existující události (období / světadíly / kategorie), vyhne se duplicitám.
// Klíč zůstává na serveru. Volá jen admin.
//
// ENV (Vercel): OPENAI_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

export const config = { maxDuration: 60 }

const CATEGORIES = ['war', 'moments', 'places', 'inventions', 'art', 'sports', 'mysteries', 'disasters']

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return }

  const SUPA = process.env.VITE_SUPABASE_URL
  const ANON = process.env.VITE_SUPABASE_ANON_KEY
  const OPENAI_KEY = process.env.OPENAI_API_KEY
  if (!OPENAI_KEY) { res.status(500).json({ error: 'missing_openai_key' }); return }

  let token = ''
  try {
    token = String(req.headers.authorization || '').replace(/^Bearer /, '')
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
  const count = Math.min(Math.max(parseInt(String(body.count)) || 10, 1), 50)

  // ── Načti existující události (souhrn pro analýzu pokrytí + dedup) ──
  let existing: Array<{ title: string; year: number | null; lat: number | null; lng: number | null; category: string | null }> = []
  try {
    const exRes = await fetch(`${SUPA}/rest/v1/events?select=title,year,lat,lng,category&limit=2000`, {
      headers: { apikey: ANON!, Authorization: `Bearer ${token}` },
    })
    if (exRes.ok) existing = await exRes.json()
  } catch { /* když selže, model navrhne i bez kontextu */ }

  // ── Denní výzva: zjisti, které nadcházející dny nemají přiřazenou událost ──
  const assigned = new Set<string>()
  try {
    const daRes = await fetch(`${SUPA}/rest/v1/daily_challenge_assignments?select=month,day&event_id=not.is.null`, {
      headers: { apikey: ANON!, Authorization: `Bearer ${token}` },
    })
    if (daRes.ok) {
      const rows = await daRes.json()
      if (Array.isArray(rows)) for (const r of rows) assigned.add(`${r.month}-${r.day}`)
    }
  } catch { /* bez denní kontroly to navrhne i tak */ }

  const upcomingMissing: string[] = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const dt = new Date(now)
    dt.setDate(now.getDate() + i)
    const m = dt.getMonth() + 1
    const d = dt.getDate()
    if (!assigned.has(`${m}-${d}`)) upcomingMissing.push(`${d}. ${m}.`)
  }

  // Kompaktní souhrn pokrytí (po stoletích a kontinentech podle lat/lng).
  const titles = existing.map(e => e.title).filter(Boolean)
  const byCentury: Record<string, number> = {}
  const byCat: Record<string, number> = {}
  for (const e of existing) {
    if (typeof e.year === 'number') {
      const c = Math.floor(e.year / 100)
      byCentury[c] = (byCentury[c] || 0) + 1
    }
    if (e.category) byCat[e.category] = (byCat[e.category] || 0) + 1
  }

  const sys = `Jsi kurátor obsahu pro vzdělávací hru typu GeoGuessr s historií. ` +
    `Navrhuješ NOVÉ historické události tak, aby vznikla rozmanitá, vyvážená sbírka. ` +
    `Cíl: vyplnit MEZERY v pokrytí — málo zastoupená historická období, málo zastoupené části světa a kategorie. ` +
    `Vyhni se DUPLICITÁM se seznamem existujících událostí (ani blízké varianty téhož). ` +
    `Každá událost musí mít konkrétní místo (ne abstraktní) a být reálná a doložitelná. ` +
    `Návrhy uspořádej do tematických SÉRIÍ / kampaní (např. „Velké objevné plavby", „Vědecká revoluce", „Cesta k měsíci"). ` +
    `Každá série má typicky PŘESNĚ 5 událostí, které spolu tematicky a chronologicky navazují, aby z nich šla poskládat postupná kampaň. ` +
    `Pokud počet návrhů není dělitelný 5, zbytek může tvořit menší sérii nebo samostatné události (series = null). ` +
    `category je jedno z: ${CATEGORIES.join(', ')}.`

  const dailyHint = upcomingMissing.length > 0
    ? `DENNÍ VÝZVA — tyto NADCHÁZEJÍCÍ dny zatím NEMAJÍ přiřazenou událost: ${upcomingMissing.join(', ')}.\n` +
      `Zařaď do návrhů konkrétní událost pro alespoň 2–3 z těchto dní — událost, která se stala přesně v daný DEN a MĚSÍC (libovolný rok), aby šla použít pro „Tento den v historii". U takových v "reason" uveď to datum.\n\n`
    : ''

  const userMsg = `Navrhni ${count} nových událostí.\n\n` +
    dailyHint +
    `EXISTUJÍCÍ NÁZVY (vyhni se jim a jejich variantám):\n${titles.slice(0, 400).join('; ') || '(žádné)'}\n\n` +
    `POKRYTÍ PODLE STOLETÍ (stoletíIndex:počet): ${JSON.stringify(byCentury)}\n` +
    `POKRYTÍ PODLE KATEGORIÍ: ${JSON.stringify(byCat)}\n\n` +
    `Vrať JSON objekt s klíčem "events" = pole ${count} položek, každá:\n` +
    `{ "title": "název česky", "year": <celé číslo, záporné = př. n. l.>, "country": "stát/lokalita", "category": "<jedna z povolených>", ` +
    `"series": "název série/kampaně nebo null, pokud událost nepatří do žádné", "reason": "krátké zdůvodnění (česky), proč doplňuje sbírku (případně které datum denní výzvy plní)" }`

  try {
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.7,
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

    const rawList: any[] = Array.isArray(parsed.events) ? parsed.events : (Array.isArray(parsed) ? parsed : [])
    const events = rawList.slice(0, count).map((e: any) => ({
      title: String(e.title || '').trim(),
      year: Number.isFinite(e.year) ? Math.round(e.year) : null,
      country: String(e.country || '').trim() || null,
      category: CATEGORIES.includes(e.category) ? e.category : null,
      series: typeof e.series === 'string' && e.series.trim() ? e.series.trim() : null,
      reason: String(e.reason || '').trim() || null,
    })).filter((e: any) => e.title)

    res.status(200).json({ events })
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', detail: String(e?.message || e) })
  }
}
