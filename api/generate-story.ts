// Vercel serverless funkce — vygeneruje delší čtenářský „příběh" události pro
// Explore/SEO stránky (sekce „Co se tady stalo"). Vrací {cs,en,de} = {titulek, odstavce[]}.
// Klíč zůstává na serveru (OPENAI_API_KEY). Volá jen admin.
//
// ENV (Vercel): OPENAI_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

// Doplněk podle kategorie — drží tón rozmanitý (viz prompts/event-story.md).
const CATEGORY_HINT: Record<string, string> = {
  war: 'Nepiš o taktice pro znalce. Zajímá tě jedno rozhodnutí, jedna chyba nebo jedna okolnost (počasí, terén, zpoždění), na kterých to viselo. Uveď lidskou cenu konkrétním číslem.',
  inventions: 'Otevři momentem, kdy to poprvé fungovalo, a řekni jak nakrátko nebo jak nejistě. Ukaž, co bylo předtím nemožné. Vyhni se technickému popisu principu — zajímá tě ten skok, ne konstrukce.',
  places: 'Popiš, co objevitel čekal a co skutečně našel. Zmiň, že místo obvykle nebylo „objeveno" — někdo tam žil nebo o něm věděl. Doveď to k tomu, co se s místem stalo potom.',
  art: 'Začni v místnosti, kde to vzniklo nebo bylo poprvé předvedeno: kdo tam byl, jak to přijali. Zmiň, jak dlouho práce trvala nebo za jakých podmínek vznikla. Skonči tím, co to změnilo v tom, jak se dílo dělalo dál.',
  disasters: 'Piš věcně a bez efektů — hrůzu unese fakt sám. Uveď, jak rychle to proběhlo a co se dochovalo právě proto. Nezneužívej utrpení k pointě.',
  moments: 'Otevři okamžikem, kdy se rozhodlo, ne kontextem. Vysvětli, co lidé v tu chvíli ještě nevěděli. Skonči tím, jak dlouho následek vydržel.',
  sports: 'Začni výkonem a číslem. Řekni, co bylo tehdy považováno za hranici možností. Zmiň, kdy a jak byl rekord překonán, pokud byl.',
  mysteries: 'Drž se doloženého a odděl fakt od dohadu jednou větou. Zajímá tě, co přesně zůstalo nevysvětleno a proč. Nesklouzni k senzaci.',
}

const SYS = `Jsi historik a redaktor, který píše krátké texty pro vzdělávací hru Historyguesser.
Hráč právě dohrál kolo o konkrétní historické události a chce vědět, co se tam
skutečně stalo. Nečte encyklopedii — chce být tím textem vtažen.

JAK PSÁT
- Česky, spisovně, bez archaismů a bez patosu.
- Začni konkrétní scénou: čas, místo, počet lidí, počasí, jeden hmatatelný detail.
  Nikdy nezačínej definicí typu "Bitva u X byla vojenské střetnutí, které…".
- Vyprávěj v minulém čase jako příběh s příčinou a následkem, ne jako výčet faktů.
- V každém odstavci uveď alespoň jedno konkrétní číslo, jméno nebo místo.
- Piš krátké a středně dlouhé věty. Jednu myšlenku za větu.
- Pomlčku (—) použij maximálně jednou na odstavec.
- Nepiš, že je něco "fascinující", "neuvěřitelné", "zásadní" nebo "ikonické" — ukaž to faktem.
- Žádné otázky na čtenáře, žádná oslovení, žádné CTA, žádné emoji, žádné nadpisy, žádné odrážky.

STRUKTURA VÝSTUPU
1. Titulek: 4–9 slov, konkrétní a překvapivý. NESMÍ obsahovat název události ani rok.
   Pojmenuj tu jednu věc, která událost dělá pozoruhodnou — číslo, paradox, důsledek.
2. První odstavec (60–90 slov): co se dělo. Otevři scénou, doveď ji do rozhodujícího momentu.
3. Druhý odstavec (60–90 slov): jak to skončilo a co to změnilo. Poslední věta ať sahá
   za samotnou událost — dopad na lidi, mapu, obor nebo dobu.

PŘESNOST
- Použij pouze fakta ze zadání a obecně nesporné historické znalosti.
- Když si nejsi jistý číslem, napiš ho zaokrouhleně, nebo ho vynech. Nevymýšlej si jména ani citace.
- U sporných výkladů napiš jednou krátkou větou, že je výklad sporný.

FORMÁT ODPOVĚDI
Vrať čistý JSON, nic jiného: {"titulek": "...", "odstavce": ["...", "..."]}`

async function assertAdmin(req: any, res: any, SUPA?: string, ANON?: string): Promise<boolean> {
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '')
    if (!token || !SUPA || !ANON) { res.status(401).json({ error: 'unauthorized' }); return false }
    const userRes = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } })
    if (!userRes.ok) { res.status(401).json({ error: 'unauthorized' }); return false }
    const user = await userRes.json()
    const profRes = await fetch(`${SUPA}/rest/v1/profiles?id=eq.${user.id}&select=role`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } })
    const prof = await profRes.json()
    if (!Array.isArray(prof) || prof[0]?.role !== 'admin') { res.status(403).json({ error: 'forbidden' }); return false }
    return true
  } catch {
    res.status(401).json({ error: 'unauthorized' }); return false
  }
}

function cleanStory(obj: any): { titulek: string; odstavce: string[] } | null {
  if (!obj || typeof obj !== 'object') return null
  const titulek = typeof obj.titulek === 'string' ? obj.titulek.trim() : ''
  const odstavce = Array.isArray(obj.odstavce)
    ? obj.odstavce.filter((p: any) => typeof p === 'string' && p.trim()).map((p: string) => p.trim())
    : []
  if (!odstavce.length) return null
  return { titulek, odstavce }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return }

  const SUPA = process.env.VITE_SUPABASE_URL
  const ANON = process.env.VITE_SUPABASE_ANON_KEY
  const OPENAI_KEY = process.env.OPENAI_API_KEY
  if (!OPENAI_KEY) { res.status(500).json({ error: 'missing_openai_key' }); return }
  if (!(await assertAdmin(req, res, SUPA, ANON))) return

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const title = String(body.title || '').trim()
  const year = body.year
  const date = String(body.event_date || '').trim()
  const place = String(body.place || '').trim()
  const category = String(body.category || '').trim()
  const facts = String(body.facts || '').trim()
  if (!title) { res.status(400).json({ error: 'missing_title' }); return }

  const sys = CATEGORY_HINT[category] ? `${SYS}\n\nDOPLNĚK PODLE KATEGORIE\n${CATEGORY_HINT[category]}` : SYS
  const userMsg = `Událost: ${title}\n` +
    `Datum: ${date || (year != null && year !== '' ? String(year) : 'neuvedeno')}\n` +
    `Místo: ${place || 'neuvedeno'}\n` +
    `Kategorie: ${category || 'neuvedeno'}\n` +
    `Známá fakta: ${facts || '(žádná dodatečná fakta — vyjdi z obecně nesporných znalostí)'}\n\n` +
    `Napiš text podle pravidel výše.`

  async function chat(model: string, messages: any[], temperature = 0.5) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model, temperature, response_format: { type: 'json_object' }, messages }),
    })
    if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text()).slice(0, 300)}`)
    const d = await r.json()
    return JSON.parse(d?.choices?.[0]?.message?.content || '{}')
  }

  try {
    // 1) CZ příběh přesně dle promptu
    const csRaw = await chat('gpt-4o', [
      { role: 'system', content: sys },
      { role: 'user', content: userMsg },
    ])
    const cs = cleanStory(csRaw)
    if (!cs) { res.status(502).json({ error: 'bad_story' }); return }

    // 2) Překlad CZ příběhu do EN a DE (zachovej strukturu, styl a čísla)
    let en: any = null, de: any = null
    try {
      const tr = await chat('gpt-4o', [
        { role: 'system', content: 'Jsi překladatel. Přelož historický text do angličtiny a němčiny. Zachovej styl, tón, počet odstavců i všechna čísla a jména. Titulek přelož významově, ne doslovně. Vrať čistý JSON.' },
        { role: 'user', content: `Zdroj (čeština): ${JSON.stringify(cs)}\n\nVrať JSON: {"en": {"titulek": "...", "odstavce": ["...","..."]}, "de": {"titulek": "...", "odstavce": ["...","..."]}}` },
      ], 0.3)
      en = cleanStory(tr?.en)
      de = cleanStory(tr?.de)
    } catch { /* překlad je best-effort; CZ vždy vrátíme */ }

    res.status(200).json({ cs, en, de })
  } catch (e: any) {
    res.status(502).json({ error: 'openai_error', detail: String(e?.message || e).slice(0, 400) })
  }
}
