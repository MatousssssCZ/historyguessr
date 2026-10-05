// Vercel serverless funkce — navrhne sběratelskou RELIKVII, která nejlépe sedí
// k dané kampani (podle jejích událostí) a NENÍ použitá v žádné jiné kampani.
// Vrací název/popis CZ/EN/DE, dataci a anglický prompt pro vygenerování obrázku.
// Klíč zůstává na serveru. Volá jen admin.
//
// ENV (Vercel): OPENAI_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

export const config = { maxDuration: 60 }

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
    if (!Array.isArray(prof) || !['admin', 'editor'].includes(prof[0]?.role)) { res.status(403).json({ error: 'forbidden' }); return }
  } catch { res.status(401).json({ error: 'unauthorized' }); return }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const campaignId = String(body.campaignId || '').trim()
  const campaignTitle = String(body.campaignTitle || '').trim()
  if (!campaignId && !campaignTitle) { res.status(400).json({ error: 'missing_campaign' }); return }

  const yl = (y: number | null) => y == null ? '?' : (y < 0 ? `${Math.abs(y)} př.n.l.` : String(y))

  // ── Události kampaně (pro kontext) ──
  let evLines: string[] = []
  try {
    if (campaignId) {
      const r = await fetch(`${SUPA}/rest/v1/campaign_events?campaign_id=eq.${campaignId}&select=position,events(title,year,category)&order=position`, {
        headers: { apikey: ANON!, Authorization: `Bearer ${token}` },
      })
      if (r.ok) {
        const rows = await r.json()
        evLines = (Array.isArray(rows) ? rows : [])
          .map((x: any) => x.events).filter(Boolean)
          .map((e: any) => `- ${e.title} (${yl(e.year)})${e.category ? ` {${e.category}}` : ''}`)
      }
    }
  } catch { /* kontext best-effort */ }

  // ── Názvy relikvií, které už existují (nutno se jim vyhnout) ──
  let existingNames: string[] = []
  try {
    const r = await fetch(`${SUPA}/rest/v1/relics?select=name,name_en&limit=2000`, {
      headers: { apikey: ANON!, Authorization: `Bearer ${token}` },
    })
    if (r.ok) {
      const rows = await r.json()
      existingNames = (Array.isArray(rows) ? rows : [])
        .flatMap((x: any) => [x.name, x.name_en]).filter(Boolean).map((s: string) => String(s).trim())
    }
  } catch { /* bez seznamu aspoň něco navrhne */ }
  const uniqNames = Array.from(new Set(existingNames))

  const sys = `Jsi historik a kurátor muzejní sbírky pro vzdělávací historickou hru. Pro zadanou kampaň navrhni JEDEN sběratelský PŘEDMĚT — relikvii.\n\n` +
    `NEJDŮLEŽITĚJŠÍ PRAVIDLA (dodrž bezpodmínečně):\n` +
    `1) PŘEDMĚT MUSÍ BÝT SKUTEČNÝ A DOLOŽENÝ — buď konkrétní dochovaný artefakt (např. „Rosettská deska", „Tutanchamonova pohřební maska"), ` +
    `nebo dobře doložený typ dobového předmětu spjatý s událostí (např. „Řecká hoplítská přilba korintského typu"). NIKDY si předmět, jeho jméno, ` +
    `nález ani provenienci nevymýšlej. Pokud si nejsi jistý existencí nebo fakty, zvol jiný, prokazatelně doložený předmět.\n` +
    `2) SPRÁVNÉ OZNAČENÍ — použij přesný, běžně uznávaný (muzejní/odborný) název předmětu ve všech jazycích. Neoznačuj předmět jako něco, čím není ` +
    `(nezaměňuj kopii za originál, repliku za artefakt, mylně nedatuj ani nepřisuzuj majiteli, pokud to není doloženo).\n` +
    `3) PRAVDIVÝ A ZAJÍMAVÝ TEXT — popis (60–90 slov) musí být fakticky přesný a zároveň čtivý: uveď, co předmět je, z čeho a jak vznikl, ` +
    `proč je pro danou událost/kampaň významný, a jednu konkrétní, ověřitelnou a poutavou okolnost (kde je dnes, kdo/kdy ho našel, k čemu sloužil). ` +
    `Žádné vycucané superlativy, žádné nejisté či smyšlené detaily, žádné legendy vydávané za fakt (legendu označ jako legendu).\n` +
    `4) UNIKÁTNOST — předmět se nesmí shodovat ani být zjevnou variantou žádného z již použitých názvů (viz seznam). Pokud by se nejlepší nápad kryl, zvol jiný vhodný doložený předmět.\n` +
    `5) ČASOVÁ A TEMATICKÁ SHODA — předmět musí sedět k událostem a období kampaně.\n\n` +
    `Výstup: název + popis v CZ, EN i DE (ekvivalentní obsah, správné odborné názvy v každém jazyce), dataci jako text (např. „480 př. n. l."), ` +
    `a stručný ANGLICKÝ prompt pro vygenerování obrázku předmětu (jeden reálný předmět uprostřed, věrný tvar/materiál, muzejní 3D render, ` +
    `měkké studiové světlo, izolovaný na průhledném pozadí, bez textu). Vrať pouze JSON.`

  const userMsg = `KAMPAŇ: "${campaignTitle || '(bez názvu)'}"\n\n` +
    `UDÁLOSTI KAMPANĚ:\n${evLines.length ? evLines.join('\n') : '(žádné přiřazené události)'}\n\n` +
    `JIŽ POUŽITÉ RELIKVIE (vyhni se jim):\n${uniqNames.length ? uniqNames.map(n => `- ${n}`).join('\n') : '(zatím žádné)'}\n\n` +
    `Vrať JSON:\n{\n` +
    `"name_cs":"...","name_en":"...","name_de":"...",\n` +
    `"description_cs":"...","description_en":"...","description_de":"...",\n` +
    `"year_label":"...","icon_prompt":"...","reason_cs":"krátké zdůvodnění proč je předmět doložený a proč sedí"\n}`

  try {
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o', temperature: 0.35, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: sys }, { role: 'user', content: userMsg }],
      }),
    })
    if (!aiRes.ok) { res.status(502).json({ error: 'openai_error', detail: (await aiRes.text()).slice(0, 400) }); return }
    const data = await aiRes.json()
    let p: any
    try { p = JSON.parse(data?.choices?.[0]?.message?.content || '{}') } catch { res.status(502).json({ error: 'bad_json' }); return }

    res.status(200).json({
      name_cs: String(p.name_cs || '').trim() || null,
      name_en: String(p.name_en || '').trim() || null,
      name_de: String(p.name_de || '').trim() || null,
      description_cs: String(p.description_cs || '').trim() || null,
      description_en: String(p.description_en || '').trim() || null,
      description_de: String(p.description_de || '').trim() || null,
      year_label: String(p.year_label || '').trim() || null,
      icon_prompt: String(p.icon_prompt || '').trim() || null,
      reason_cs: String(p.reason_cs || '').trim() || null,
    })
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', detail: String(e?.message || e) })
  }
}
