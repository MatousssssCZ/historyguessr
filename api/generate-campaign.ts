// Vercel serverless funkce — z názvu kampaně navrhne vše potřebné:
// popis (CZ/EN/DE), výběr EXISTUJÍCÍCH událostí z DB (tematicky + chronologicky),
// a návrh relikvie (název/popis CZ/EN/DE, datace + prompt na ikonu).
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

  // ── Ověření admina ──────────────────────────────────────
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '')
    if (!token || !SUPA || !ANON) { res.status(401).json({ error: 'unauthorized' }); return }
    const userRes = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } })
    if (!userRes.ok) { res.status(401).json({ error: 'unauthorized' }); return }
    const user = await userRes.json()
    const profRes = await fetch(`${SUPA}/rest/v1/profiles?id=eq.${user.id}&select=role`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } })
    const prof = await profRes.json()
    if (!Array.isArray(prof) || prof[0]?.role !== 'admin') { res.status(403).json({ error: 'forbidden' }); return }
  } catch { res.status(401).json({ error: 'unauthorized' }); return }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const name = String(body.name || '').trim()
  const rounds = Math.min(Math.max(parseInt(String(body.rounds)) || 5, 1), 10)
  if (!name) { res.status(400).json({ error: 'missing_name' }); return }

  // ── Kandidátní události (publikované) — model z nich vybírá přes index ──
  let events: Array<{ id: string; title: string; year: number | null; category: string | null }> = []
  try {
    const exRes = await fetch(`${SUPA}/rest/v1/events?select=id,title,year,category&published=eq.true&order=year.asc&limit=800`, {
      headers: { apikey: ANON!, Authorization: `Bearer ${token}` },
    })
    if (exRes.ok) events = await exRes.json()
  } catch { /* bez kandidátů aspoň popis + relikvie */ }

  const yl = (y: number | null) => y == null ? '?' : (y < 0 ? `${Math.abs(y)} př.n.l.` : String(y))
  const catalog = events.map((e, i) => `[${i}] ${e.title} (${yl(e.year)}) {${e.category ?? '-'}}`).join('\n')

  const sys = `Jsi kurátor vzdělávací historické hry (GeoGuessr pro historii). Z NÁZVU kampaně navrhni ucelenou kampaň. ` +
    `Vybíráš POUZE z dodaného KATALOGU existujících událostí (vracíš jejich indexy) — nic nevymýšlíš mimo katalog. ` +
    `Vyber ${rounds} událostí, které spolu tematicky i chronologicky nejlépe tvoří kampaň „${name}"; seřaď je CHRONOLOGICKY (nejstarší první). ` +
    `Pokud je vhodných méně, vrať méně. ` +
    `Napiš poutavý, fakticky přesný popis kampaně (cca 40–70 slov, bez markdownu) a přelož název i popis do EN a DE. ` +
    `Navrhni jednu sběratelskou RELIKVII, která kampaň symbolizuje (konkrétní historický předmět, ne abstraktní): ` +
    `název + popis (60–90 slov) CZ/EN/DE, dataci jako text (např. „480 př. n. l."), a stručný ANGLICKÝ prompt pro vygenerování ikony relikvie ` +
    `(jeden předmět uprostřed, muzejní 3D render, měkké studiové světlo, bez textu a pozadí).`

  const userMsg = `NÁZEV KAMPANĚ: "${name}"\n\n` +
    `KATALOG UDÁLOSTÍ (vybírej indexy odtud):\n${catalog || '(katalog prázdný)'}\n\n` +
    `Vrať JSON:\n{\n` +
    `"title_en": "...", "title_de": "...",\n` +
    `"description_cs": "...", "description_en": "...", "description_de": "...",\n` +
    `"event_indexes": [čísla indexů z katalogu, chronologicky, max ${rounds}],\n` +
    `"relic": { "name_cs":"...","name_en":"...","name_de":"...","description_cs":"...","description_en":"...","description_de":"...","year_label":"...","icon_prompt":"..." }\n}`

  try {
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o', temperature: 0.6, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: sys }, { role: 'user', content: userMsg }],
      }),
    })
    if (!aiRes.ok) { res.status(502).json({ error: 'openai_error', detail: (await aiRes.text()).slice(0, 400) }); return }
    const data = await aiRes.json()
    let p: any
    try { p = JSON.parse(data?.choices?.[0]?.message?.content || '{}') } catch { res.status(502).json({ error: 'bad_json' }); return }

    const idxs: number[] = Array.isArray(p.event_indexes) ? p.event_indexes : []
    const picked = idxs
      .map((n: any) => events[Math.round(Number(n))])
      .filter((e: any) => e && e.id)
      .slice(0, rounds)
      .map((e: any) => ({ id: e.id, title: e.title, year: e.year, category: e.category }))

    const r = p.relic || {}
    res.status(200).json({
      title_en: String(p.title_en || '').trim() || null,
      title_de: String(p.title_de || '').trim() || null,
      description_cs: String(p.description_cs || '').trim() || null,
      description_en: String(p.description_en || '').trim() || null,
      description_de: String(p.description_de || '').trim() || null,
      events: picked,
      relic: {
        name_cs: String(r.name_cs || '').trim() || null,
        name_en: String(r.name_en || '').trim() || null,
        name_de: String(r.name_de || '').trim() || null,
        description_cs: String(r.description_cs || '').trim() || null,
        description_en: String(r.description_en || '').trim() || null,
        description_de: String(r.description_de || '').trim() || null,
        year_label: String(r.year_label || '').trim() || null,
        icon_prompt: String(r.icon_prompt || '').trim() || null,
      },
    })
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', detail: String(e?.message || e) })
  }
}
