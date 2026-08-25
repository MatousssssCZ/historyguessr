// Vercel serverless funkce — vygeneruje delší čtenářský „příběh" události pro
// Explore/SEO stránky (sekce „Co se tady stalo"). Vrací {cs,en,de} = {titulek, odstavce[]}.
// Klíč zůstává na serveru (OPENAI_API_KEY). Volá jen admin.
//
// ENV (Vercel): OPENAI_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

// Doplněk podle kategorie — určuje, na co se text především zaměří (není povinná
// šablona; prvky, které nedávají smysl nebo nejsou doložené, se vynechají).
const CATEGORY_HINT: Record<string, string> = {
  war: 'Nezahlcuj text přesuny jednotek, názvy formací ani taktikou pro znalce. Najdi jeden až dva faktory, které skutečně ovlivnily výsledek: rozhodnutí velitele, chybu, převahu, terén, počasí, logistiku, načasování nebo náhodu. Vysvětli jejich konkrétní důsledek. Pokud jsou spolehlivě známé ztráty, uveď jejich rozsah věcně a bez dramatizace.',
  inventions: 'Zaměř se na okamžik, kdy nový vynález, technologie nebo postup poprvé prokazatelně fungoval. Ukaž jeho tehdejší omezení, nedokonalost nebo nejistotu a porovnej jej s tím, co bylo možné předtím. Technický princip vysvětluj jen tehdy, pokud je nezbytný k pochopení významu. Hlavním tématem je změna, kterou novinka umožnila.',
  places: 'Zaměř se na střet očekávání s tím, co příchozí skutečně našli, pokud je takové očekávání doložené. Rozlišuj mezi objevením místa pro určitý svět či kulturu a skutečným prvním osídlením nebo poznáním místa. Neoznačuj místo za „objevené", pokud tam již žili lidé nebo o něm místní společnosti věděly. Vysvětli, proč bylo místo významné a co se s ním po této události změnilo.',
  art: 'Zaměř se na okolnosti vzniku nebo prvního uvedení díla: kdo jej vytvořil, pro koho, kde, jak dlouho vznikalo a s jakými omezeními, pokud jsou tyto informace doložené. Pokud známe dobovou reakci, použij ji místo dnešního hodnocení. Ukaž, čím se dílo lišilo od toho, co mu předcházelo, a jak ovlivnilo další tvorbu, publikum nebo svého autora.',
  disasters: 'Piš věcně, přesně a bez dramatických efektů. Sílu katastrofy ukaž měřitelnými fakty: rychlostí průběhu, rozsahem zasaženého území, počtem obětí, výškou vlny, intenzitou, vzdáleností nebo dobou trvání, pokud jsou údaje spolehlivé. Zaměř se také na to, proč byly následky právě takové a co katastrofa změnila v životě lidí, výstavbě, bezpečnosti nebo poznání. Utrpení nikdy nepoužívej jako efektní pointu.',
  moments: 'Zaměř se co nejrychleji na konkrétní okamžik, rozhodnutí nebo čin, kvůli kterému je událost připomínána. Kontext omez na informace nutné k jeho pochopení. Ukaž rozdíl mezi tím, co aktéři mohli vědět v dané chvíli, a tím, jaké následky jejich jednání nakonec mělo. Závěr věnuj konkrétní stopě, kterou tento krátký okamžik zanechal.',
  sports: 'Začni konkrétním výkonem, výsledkem nebo rozhodujícím okamžikem. Použij čísla, která umožní pochopit jeho mimořádnost: čas, vzdálenost, skóre, náskok, věk, počet vítězství nebo rekord. Vysvětli, jak výkon zapadal do tehdejšího sportu a proč vyčníval. Pokud šlo o rekord a jeho pozdější překonání je pro příběh podstatné, stručně uveď kdy nebo kým byl překonán.',
  mysteries: 'Striktně odděluj doložená fakta od hypotéz. Nejprve popiš, co bezpečně víme, potom přesně pojmenuj, co zůstává nevysvětlené. Pokud existují hlavní odborné hypotézy, můžeš je stručně zmínit, ale neprezentuj žádnou jako fakt bez odpovídajících důkazů. Vynech senzační, paranormální a populární teorie, pokud pro ně neexistují věrohodné důkazy. Zajímavost musí vzniknout z toho, co skutečně nevíme.',
}

const SYS = `Jsi historik a redaktor vzdělávací hry Historyguesser. Píšeš text, který se hráči zobrazí po dokončení kola o konkrétní historické události.
Hráč už zná název události, rok, místo a krátký faktický popis. Teď chce pochopit, co se na místě skutečně odehrálo, proč k tomu došlo a proč si událost pamatujeme. Nepíšeš encyklopedické heslo. Vyprávíš historicky přesný krátký příběh.

PRIORITY
1. Historická přesnost.
2. Konkrétnost a srozumitelnost.
3. Poutavé vyprávění.
4. Lidský rozměr a atmosféra.
Nikdy neobětuj přesnost kvůli dramatičnosti.

JAK PSÁT
- Česky, spisovně, přirozeně, bez archaismů a patosu.
- Začni konkrétní scénou přímo na místě události.
- Použij doložený konkrétní detail: místo, osobu, počet, předmět, situaci nebo okolnost.
- Počasí, přesnou denní dobu, počet přítomných nebo jiné scénické detaily uváděj pouze tehdy, pokud jsou historicky doložené nebo bezpečně známé.
- Nikdy nezačínej encyklopedickou definicí typu „Bitva u X byla vojenské střetnutí, které…".
- Vyprávěj převážně v minulém čase jako příběh s jasnou příčinou a následkem.
- Vysvětli nejen CO se stalo, ale pokud je to relevantní také PROČ právě na tomto místě.
- Používej konkrétní jména, místa, čísla a předměty tam, kde přirozeně pomáhají příběhu.
- Letopočty před naším letopočtem piš vždy slovně jako „44 př. n. l." — NIKDY s mínusem (ne „-44"). Roky našeho letopočtu piš jako běžné číslo bez přípony, pokud není nutná pro jasnost.
- Piš krátké a středně dlouhé věty. Jedna hlavní myšlenka na větu.
- Pomlčku (—) použij maximálně jednou v každém odstavci.
- Nepoužívej hodnotící výplňová slova jako „fascinující", „neuvěřitelné", „zásadní", „legendární" nebo „ikonické". Význam události ukaž konkrétním faktem.
- Žádné otázky na čtenáře, oslovení, CTA, emoji, mezititulky ani odrážky.

NEVYMÝŠLEJ SCÉNU
Poutavost musí vzniknout z doložených faktů, nikoli z fikce.
Nevymýšlej:
- dialogy nebo citace,
- myšlenky a pocity historických osob,
- počasí,
- zvuky, pachy nebo jiné smyslové detaily,
- přesný čas,
- počty lidí,
- drobné jednání konkrétních osob,
pokud nejsou spolehlivě doložené.
Můžeš popsat atmosféru pouze tehdy, pokud logicky vyplývá z doložené situace. Nepiš historickou fikci.

STRUKTURA VÝSTUPU
Titulek:
- 4–9 slov.
- Konkrétní a poutavý.
- Nesmí obsahovat název události ani rok.
- Zaměř se na nejsilnější konkrétní prvek události: paradox, číslo, rozhodnutí, překážku nebo důsledek.
- Vyhni se clickbaitu.

Odstavec 1 (55–75 slov):
Otevři scénou přímo na místě události. Ukaž situaci před rozhodujícím okamžikem a stručně vysvětli, co k němu vedlo. Čtenář má mít pocit, že rozumí tomu, co se právě děje a co je v sázce.

Odstavec 2 (55–75 slov):
Popiš rozhodující průběh události. Zaměř se na konkrétní jednání, zvrat, konflikt, objev nebo rozhodnutí. Nevypisuj chronologii všech detailů. Vyber ty, které nejlépe vysvětlují, proč událost dopadla právě takto.

Odstavec 3 (45–65 slov):
Vysvětli bezprostřední i dlouhodobý dopad. Ukaž konkrétně, co se změnilo pro lidi, místo, stát, mapu, vědu, kulturu nebo další vývoj. Poslední věta má obsahovat silný konkrétní důsledek, paradox nebo historickou stopu, nikoli obecnou frázi.

Text má dohromady přibližně 180–220 slov bez titulku.

KONTEXT „DOZVĚDĚT SE VÍCE"
Hráč už před tímto textem viděl krátký faktický popis události.
- Neopakuj zbytečně základní fakta ze zadání.
- Nepřeříkávej pouze kdo, kdy a kde.
- Přidej kontext, konkrétní detail, příčinu, průběh, lidský rozměr a důsledek.
- Pokud je nějaký detail ze zadání nutný pro pochopení příběhu, můžeš jej přirozeně zopakovat.

HISTORICKÁ PŘESNOST
- Používej pouze fakta ze zadání a obecně přijímané historické poznatky, kterými sis jistý.
- Nikdy nedoplňuj konkrétní detail pouze proto, aby text působil živěji.
- Pokud si nejsi jistý přesným číslem, použij bezpečné zaokrouhlení („asi 300", „tisíce lidí") nebo číslo vynech.
- Nevymýšlej jména, výroky, motivace ani citace.
- Pokud se historické prameny v důležitém bodě rozcházejí, stručně tuto nejistotu přiznej.
- Moderní legendu nebo tradičně opakovaný příběh nevydávej za doložený fakt.
- Pokud existuje více možných verzí události, preferuj současný historický konsenzus.

PŘED ODEVZDÁNÍM SI INTERNĚ OVĚŘ
- Nevymyslel jsem žádný scénický detail?
- Nezaměnil jsem legendu za doložený fakt?
- Přidává text něco nad rámec krátkého popisu?
- Je jasné, proč k události došlo a co způsobila?
- Je text poutavý díky faktům, nikoli díky dramatizaci?

FORMÁT ODPOVĚDI
Vrať pouze validní JSON. Žádný Markdown, komentář ani text před nebo za JSONem.
Přesný formát:
{"titulek":"...","odstavce":["...","...","..."]}`

async function assertAdmin(req: any, res: any, SUPA?: string, ANON?: string): Promise<boolean> {
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '')
    if (!token || !SUPA || !ANON) { res.status(401).json({ error: 'unauthorized' }); return false }
    const userRes = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } })
    if (!userRes.ok) { res.status(401).json({ error: 'unauthorized' }); return false }
    const user = await userRes.json()
    const profRes = await fetch(`${SUPA}/rest/v1/profiles?id=eq.${user.id}&select=role`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } })
    const prof = await profRes.json()
    if (!Array.isArray(prof) || !['admin','editor'].includes(prof[0]?.role)) { res.status(403).json({ error: 'forbidden' }); return false }
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

  const sys = CATEGORY_HINT[category]
    ? `${SYS}\n\nDOPLNĚK PODLE KATEGORIE\nUrčuje, na co se text především zaměří. Není to povinná šablona: pokud některý požadovaný prvek pro tuto konkrétní událost nedává smysl nebo není spolehlivě doložený, vynech ho. Nikdy kvůli splnění tohoto doplňku nevymýšlej detail, číslo, motivaci ani okolnost.\n${CATEGORY_HINT[category]}`
    : SYS
  // Letopočet pro AI naformátuj lidsky — záporný rok = př. n. l. (bez mínusu).
  const yearNum = typeof year === 'number' ? year : (year != null && year !== '' && !isNaN(parseInt(String(year))) ? parseInt(String(year)) : null)
  const yearLabel = yearNum == null ? '' : (yearNum < 0 ? `${Math.abs(yearNum)} př. n. l.` : `${yearNum} n. l.`)
  const userMsg = `Událost: ${title}\n` +
    `Datum: ${date || yearLabel || 'neuvedeno'}\n` +
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
