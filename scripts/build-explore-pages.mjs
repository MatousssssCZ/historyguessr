// SSG generátor veřejné Explore vrstvy. Běží po `vite build` (viz package.json).
// Načte publikované události ze Supabase a pro každou × jazyk vygeneruje
// statické, robotem čitelné HTML (detail události) + sitemap.xml + robots.txt.
//
// F1 (pilot): detail události. Výpis/kategorie/kampaně/homepage přibudou dál.
import { writeFileSync, mkdirSync, existsSync, copyFileSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SITE_ORIGIN, LOCALES, PATH_SEG, CATEGORIES, CATEGORY_KEYS,
  eventPath, categoryPath, exploreListPath, campaignPath, abs, playEventPath,
  eventSlugFor, eventTitleFor, eventDescriptionFor, eventStoryFor,
  escapeHtml, formatYear, slugify,
} from './explore-shared.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')

const SUPA = process.env.VITE_SUPABASE_URL || 'https://wgiijdnoiiuxxucacyio.supabase.co'
// Anon klíč je veřejný (RLS chrání data). Fallback = produkční anon z .env.
const ANON = process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnaWlqZG5vaWl1eHh1Y2FjeWlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzgyNDgsImV4cCI6MjA5MzQxNDI0OH0.vk8rDFt86H_v0WjcGimbfS4BmTnwa9pfWqWP9tgKuaY'

// ── UI řetězce (statické stránky mají vlastní kopii, appka je nesdílí) ──────
const UI = {
  cs: {
    home: 'Domů', explore: 'Objevuj historii',
    whatHappened: 'Co se tady stalo?', whyImportant: 'Proč to bylo důležité?',
    related: 'Související události', facts: 'Fakta', dateL: 'Datum', placeL: 'Místo',
    periodL: 'Období', categoryL: 'Kategorie', play: 'Zahrát tuto událost',
    view360: 'Prohlédnout ve 360°', explore_cta: 'Objevit historii',
    reconstruction: 'Panorama je historicky pravděpodobná rekonstrukce vytvořená pomocí AI.',
    metaSuffix: 'Historyguesser', tagline: 'GeoGuessr pro historii',
    listH1: 'Okamžiky, které utvořily náš svět',
    listSub: 'Prozkoumej historické události z celého světa — každou si můžeš i zahrát.',
    listMeta: 'Objevuj stovky historických okamžiků na Historyguesser: kde se staly a v jakém roce.',
    allEvents: 'Všechny události', allCats: 'Vše', filterBy: 'Kategorie',
    explore_word: 'událostí', playCta: 'Prozkoumat', backToList: 'Zpět na výpis',
    catMetaPrefix: 'Historické události v kategorii',
    homeKicker: 'Vzdělávací hra', homePlay: 'Hrát',
    homeH1: 'Stůj tam, kde se psaly dějiny',
    homeSub: 'Ocitneš se v 360° panoramatu historického místa. Uhodneš, kde na světě jsi a v jakém roce se to stalo?',
    homeMeta: 'Historyguesser je vzdělávací hra jako GeoGuessr, ale pro historii. Stojíš v 360° panoramatu historického místa a hádáš, kde a kdy se událost stala.',
    homeBrowse: 'k prozkoumání',
    howTitle: 'Jak to funguje',
    steps: [
      ['Rozhlédni se', 'Prozkoumej 360° panorama — architektura, krajina, oblečení. Vodítka jsou všude.'],
      ['Urči místo a rok', 'Klepni do mapy, kde na světě to je, a posuvníkem odhadni rok události.'],
      ['Získej body', 'Čím blíž skutečnému místu a roku, tím víc bodů, úrovní a odznaků.'],
    ],
    featuredTitle: 'Vybrané okamžiky',
    campKicker: 'Kampaň', campRounds: 'kol', campPlay: 'Hrát kampaň',
    campTimeline: 'Kola kampaně', campaignsTitle: 'Kampaně',
  },
  en: {
    home: 'Home', explore: 'Explore history',
    whatHappened: 'What happened here?', whyImportant: 'Why did it matter?',
    related: 'Related events', facts: 'Facts', dateL: 'Date', placeL: 'Place',
    periodL: 'Period', categoryL: 'Category', play: 'Play this event',
    view360: 'View in 360°', explore_cta: 'Explore history',
    reconstruction: 'The panorama is a historically plausible reconstruction created with AI.',
    metaSuffix: 'Historyguesser', tagline: 'GeoGuessr for history',
    listH1: 'Moments that shaped our world',
    listSub: 'Explore historical events from around the world — and play any of them.',
    listMeta: 'Explore hundreds of historical moments on Historyguesser: where they happened and in what year.',
    allEvents: 'All events', allCats: 'All', filterBy: 'Category',
    explore_word: 'events', playCta: 'Explore', backToList: 'Back to list',
    catMetaPrefix: 'Historical events in category',
    homeKicker: 'Educational game', homePlay: 'Play',
    homeH1: 'Stand where history happened',
    homeSub: 'You wake up in a 360° panorama of a historical place. Can you guess where in the world you are — and in what year it happened?',
    homeMeta: 'Historyguesser is an educational game like GeoGuessr, but for history. You stand in a 360° panorama of a historical place and guess where and when the event happened.',
    homeBrowse: 'to explore',
    howTitle: 'How it works',
    steps: [
      ['Look around', 'Explore the 360° panorama — architecture, landscape, clothing. Clues are everywhere.'],
      ['Place it in space and time', 'Tap the map for where in the world it is, and use the slider to guess the year.'],
      ['Earn points', 'The closer to the real place and year, the more points, levels and badges you earn.'],
    ],
    featuredTitle: 'Featured moments',
    campKicker: 'Campaign', campRounds: 'rounds', campPlay: 'Play campaign',
    campTimeline: 'Campaign rounds', campaignsTitle: 'Campaigns',
  },
  de: {
    home: 'Start', explore: 'Geschichte entdecken',
    whatHappened: 'Was geschah hier?', whyImportant: 'Warum war es wichtig?',
    related: 'Verwandte Ereignisse', facts: 'Fakten', dateL: 'Datum', placeL: 'Ort',
    periodL: 'Epoche', categoryL: 'Kategorie', play: 'Dieses Ereignis spielen',
    view360: 'In 360° ansehen', explore_cta: 'Geschichte entdecken',
    reconstruction: 'Das Panorama ist eine historisch plausible, mit KI erstellte Rekonstruktion.',
    metaSuffix: 'Historyguesser', tagline: 'GeoGuessr für Geschichte',
    listH1: 'Momente, die unsere Welt prägten',
    listSub: 'Entdecke historische Ereignisse aus aller Welt — und spiele jedes davon.',
    listMeta: 'Entdecke Hunderte historischer Momente auf Historyguesser: wo sie geschahen und in welchem Jahr.',
    allEvents: 'Alle Ereignisse', allCats: 'Alle', filterBy: 'Kategorie',
    explore_word: 'Ereignisse', playCta: 'Entdecken', backToList: 'Zur Übersicht',
    catMetaPrefix: 'Historische Ereignisse in der Kategorie',
    homeKicker: 'Lernspiel', homePlay: 'Spielen',
    homeH1: 'Steh dort, wo Geschichte geschah',
    homeSub: 'Du erwachst in einem 360°-Panorama eines historischen Ortes. Errätst du, wo auf der Welt du bist — und in welchem Jahr es geschah?',
    homeMeta: 'Historyguesser ist ein Lernspiel wie GeoGuessr, aber für Geschichte. Du stehst in einem 360°-Panorama eines historischen Ortes und errätst, wo und wann das Ereignis geschah.',
    homeBrowse: 'zu entdecken',
    howTitle: 'So funktioniert es',
    steps: [
      ['Sieh dich um', 'Erkunde das 360°-Panorama — Architektur, Landschaft, Kleidung. Überall sind Hinweise.'],
      ['Ort und Zeit bestimmen', 'Tippe auf die Karte für den Ort und stelle mit dem Regler das Jahr ein.'],
      ['Punkte sammeln', 'Je näher am echten Ort und Jahr, desto mehr Punkte, Level und Abzeichen.'],
    ],
    featuredTitle: 'Ausgewählte Momente',
    campKicker: 'Kampagne', campRounds: 'Runden', campPlay: 'Kampagne spielen',
    campTimeline: 'Kampagnen-Runden', campaignsTitle: 'Kampagnen',
  },
}

// ── Statické stránky (O projektu, Jak hrát) ─────────────────────────────────
// Kontakt je záměrně placeholder — e-mail doplní provozovatel (osobní údaj).
const CONTACT_PLACEHOLDER = 'historyguesser.net@gmail.com'
const STATIC = {
  cs: {
    about: {
      slug: 'o-projektu', title: 'O projektu',
      lead: 'Historyguesser je vzdělávací hra inspirovaná GeoGuessrem, ale zaměřená na historii. Postavíme tě do 360° panoramatu historického místa a ty hádáš, kde na světě jsi a v jakém roce se událost odehrála.',
      sections: [
        ['Proč to vzniklo', ['Historie se špatně učí z dat a jmen. Když ale stojíš přímo na místě, kde se něco stalo, a musíš odhadnout kde a kdy to bylo, zapamatuješ si to jinak. Historyguesser propojuje zeměpis, dějiny a hru do jednoho — poznávání skrze zvědavost, ne memorování.']],
        ['Jak vznikají panoramata', ['Většina panoramat jsou historicky pravděpodobné rekonstrukce vytvořené pomocí umělé inteligence na základě dostupných historických podkladů. Nejde o dobové fotografie — u většiny událostí žádné neexistují. Snažíme se, aby rekonstrukce odpovídala tomu, jak místo v dané době pravděpodobně vypadalo, ale je to interpretace, ne důkaz. U každého panoramatu je toto přiznáno.']],
        ['Historická přesnost', ['Data o událostech (místo, rok, popis) čerpáme z obecně dostupných a nesporných historických zdrojů. U nejistých nebo sporných výkladů se to snažíme uvést. Když najdeš chybu, dej nám vědět — bereme přesnost vážně a texty průběžně opravujeme.']],
        ['Vzdělávací účel', ['Hra je zdarma a míří na kohokoli, kdo má rád historii — od žáků po dospělé. Cílem není nahradit učebnici, ale vzbudit zvědavost a chuť dozvědět se víc o místech a okamžicích, které utvářely náš svět.']],
        ['Kontakt', [`Zpětnou vazbu, opravy i návrhy na nové události uvítáme na ${CONTACT_PLACEHOLDER}.`]],
      ],
    },
    howto: {
      slug: 'jak-hrat', title: 'Jak hrát',
      lead: 'Každé kolo tě postaví do panoramatu jednoho historického místa. Tvým úkolem je určit, kde na světě to je, a v jakém roce se událost stala.',
      sections: [
        ['1. Rozhlédni se', ['Panorama si můžeš otočit dokola. Hledej vodítka — architektura, krajina, oblečení lidí, technika. Každý detail může napovědět, na jakém kontinentu a v jaké době se nacházíš.']],
        ['2. Urči místo', ['Klepni do mapy tam, kde myslíš, že se událost odehrála. Čím blíž skutečnému místu, tím víc bodů za polohu.']],
        ['3. Odhadni rok', ['Posuvníkem nastav rok. Modrá znamená před naším letopočtem, oranžová náš letopočet. Čím blíž skutečnému roku, tím víc bodů za čas.']],
        ['Jak se počítají body', ['Za každé kolo můžeš získat až 1000 bodů — 500 za polohu a 500 za rok. Body klesají s tím, jak daleko jsi od skutečného místa a roku. Za přesné trefy se sbírají zkušenosti, úrovně a odznaky.']],
        ['Herní režimy', ['Sólo hra pro klasické kolo, denní výzva „Tento den v historii" (jedno kolo, jeden pokus denně), tematické kampaně a multiplayer až pro 12 hráčů, kde soutěžíte ve stejných kolech.']],
      ],
    },
  },
  en: {
    about: {
      slug: 'about', title: 'About',
      lead: 'Historyguesser is an educational game inspired by GeoGuessr, but focused on history. It drops you into a 360° panorama of a historical place and asks you to guess where in the world you are and in what year the event happened.',
      sections: [
        ['Why it exists', ['History is hard to learn from dates and names alone. But when you stand where something happened and have to guess where and when, it sticks differently. Historyguesser blends geography, history and play into one — learning through curiosity, not memorisation.']],
        ['How the panoramas are made', ['Most panoramas are historically plausible reconstructions created with artificial intelligence, based on available historical sources. They are not period photographs — for most events none exist. We aim for the reconstruction to match how the place likely looked at the time, but it is an interpretation, not proof. This is disclosed on every panorama.']],
        ['Historical accuracy', ['Event data (place, year, description) is drawn from widely available and uncontested historical sources. Where an interpretation is uncertain or disputed, we try to say so. If you spot an error, let us know — we take accuracy seriously and correct texts continuously.']],
        ['Educational purpose', ['The game is free and aimed at anyone who enjoys history — from pupils to adults. The goal is not to replace a textbook, but to spark curiosity about the places and moments that shaped our world.']],
        ['Contact', [`We welcome feedback, corrections and suggestions for new events at ${CONTACT_PLACEHOLDER}.`]],
      ],
    },
    howto: {
      slug: 'how-to-play', title: 'How to play',
      lead: 'Each round places you inside a panorama of one historical place. Your task is to work out where in the world it is and in what year the event happened.',
      sections: [
        ['1. Look around', ['You can turn the panorama all the way around. Look for clues — architecture, landscape, clothing, technology. Every detail can hint at the continent and the era.']],
        ['2. Place it', ['Tap the map where you think the event happened. The closer to the real place, the more location points you earn.']],
        ['3. Guess the year', ['Use the slider to set the year. Blue means BC, orange means AD. The closer to the real year, the more time points you earn.']],
        ['How scoring works', ['Each round is worth up to 1000 points — 500 for location and 500 for the year. Points fall off the further you are from the real place and year. Accurate guesses earn experience, levels and badges.']],
        ['Game modes', ['Solo play for a classic round, the daily "This day in history" challenge (one round, one attempt per day), themed campaigns, and multiplayer for up to 12 players competing on the same rounds.']],
      ],
    },
  },
  de: {
    about: {
      slug: 'ueber-uns', title: 'Über das Projekt',
      lead: 'Historyguesser ist ein Lernspiel, inspiriert von GeoGuessr, aber mit Fokus auf Geschichte. Es versetzt dich in ein 360°-Panorama eines historischen Ortes und fragt, wo auf der Welt du bist und in welchem Jahr das Ereignis geschah.',
      sections: [
        ['Warum es entstand', ['Geschichte lässt sich aus Daten und Namen schwer lernen. Doch wenn du dort stehst, wo etwas geschah, und erraten musst, wo und wann, bleibt es anders hängen. Historyguesser verbindet Geografie, Geschichte und Spiel — Lernen durch Neugier, nicht durch Auswendiglernen.']],
        ['Wie die Panoramen entstehen', ['Die meisten Panoramen sind historisch plausible Rekonstruktionen, die mit künstlicher Intelligenz auf Basis verfügbarer historischer Quellen erstellt wurden. Es sind keine zeitgenössischen Fotografien — für die meisten Ereignisse gibt es keine. Wir bemühen uns, dass die Rekonstruktion dem wahrscheinlichen damaligen Aussehen entspricht, doch es ist eine Interpretation, kein Beweis. Dies wird bei jedem Panorama offengelegt.']],
        ['Historische Genauigkeit', ['Die Ereignisdaten (Ort, Jahr, Beschreibung) stammen aus allgemein verfügbaren und unstrittigen historischen Quellen. Bei unsicheren oder umstrittenen Deutungen versuchen wir, dies anzumerken. Wenn du einen Fehler findest, sag uns Bescheid — wir nehmen Genauigkeit ernst und korrigieren die Texte laufend.']],
        ['Bildungszweck', ['Das Spiel ist kostenlos und richtet sich an alle, die Geschichte mögen — von Schülern bis Erwachsenen. Ziel ist nicht, ein Lehrbuch zu ersetzen, sondern Neugier auf die Orte und Momente zu wecken, die unsere Welt prägten.']],
        ['Kontakt', [`Feedback, Korrekturen und Vorschläge für neue Ereignisse sind willkommen unter ${CONTACT_PLACEHOLDER}.`]],
      ],
    },
    howto: {
      slug: 'spielanleitung', title: 'Spielanleitung',
      lead: 'Jede Runde versetzt dich in ein Panorama eines historischen Ortes. Deine Aufgabe ist herauszufinden, wo auf der Welt es ist und in welchem Jahr das Ereignis geschah.',
      sections: [
        ['1. Sieh dich um', ['Du kannst das Panorama ganz herumdrehen. Suche nach Hinweisen — Architektur, Landschaft, Kleidung, Technik. Jedes Detail kann auf Kontinent und Epoche hindeuten.']],
        ['2. Ort bestimmen', ['Tippe auf die Karte, wo das Ereignis deiner Meinung nach geschah. Je näher am echten Ort, desto mehr Ortspunkte.']],
        ['3. Jahr schätzen', ['Stelle mit dem Regler das Jahr ein. Blau bedeutet v. Chr., Orange n. Chr. Je näher am echten Jahr, desto mehr Zeitpunkte.']],
        ['Wie die Punkte zählen', ['Jede Runde bringt bis zu 1000 Punkte — 500 für den Ort und 500 für das Jahr. Die Punkte sinken, je weiter du vom echten Ort und Jahr entfernt bist. Genaue Schätzungen bringen Erfahrung, Level und Abzeichen.']],
        ['Spielmodi', ['Solospiel für eine klassische Runde, die tägliche Herausforderung „Dieser Tag in der Geschichte" (eine Runde, ein Versuch pro Tag), thematische Kampagnen und Mehrspieler für bis zu 12 Spieler auf denselben Runden.']],
      ],
    },
  },
}

const BASE_COLS = [
  'id', 'seq', 'title', 'title_en', 'title_de', 'description', 'description_en', 'description_de',
  'year', 'year_from', 'year_to', 'event_date', 'lat', 'lng',
  'panorama_url', 'preview_url', 'event_image_url', 'category', 'published',
]
// Volitelné — přibývají migrací 20260821120000. Do aplikace migrace na prod
// chybí, proto fetch umí spadnout na základní sadu (slugy se dopočítají lokálně).
const OPT_COLS = ['slug', 'slug_en', 'slug_de', 'story_cs', 'story_en', 'story_de']

async function fetchWith(cols) {
  const url = `${SUPA}/rest/v1/events?select=${cols.join(',')}&published=eq.true&order=seq.asc`
  const res = await fetch(url, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } })
  return res
}

async function fetchEvents() {
  let res = await fetchWith([...BASE_COLS, ...OPT_COLS])
  if (!res.ok) {
    const body = await res.text()
    if (res.status === 400 && /column .* does not exist/.test(body)) {
      console.warn('[explore] Explore sloupce zatím nejsou v DB (migrace 20260821120000) — používám základní sadu, slugy dopočítám lokálně.')
      res = await fetchWith(BASE_COLS)
    } else {
      throw new Error(`Supabase fetch ${res.status}: ${body}`)
    }
  }
  if (!res.ok) throw new Error(`Supabase fetch ${res.status}: ${await res.text()}`)
  return res.json()
}

/** Publikované kampaně + jejich kola. Vrací [] když anon nemá přístup (před migrací 20260821140000). */
async function fetchCampaigns(eventsById) {
  const H = { apikey: ANON, Authorization: `Bearer ${ANON}` }
  const cRes = await fetch(`${SUPA}/rest/v1/campaigns?select=id,slug,title,title_en,title_de,description,description_en,description_de,visual_url,rounds_count,status&status=eq.published&order=seq.asc`, { headers: H })
  if (!cRes.ok) { console.warn(`[explore] Kampaně nedostupné (${cRes.status}) — přeskakuji. Aplikuj migraci 20260821140000.`); return [] }
  const campaigns = await cRes.json()
  if (!campaigns.length) return []
  const eRes = await fetch(`${SUPA}/rest/v1/campaign_events?select=campaign_id,position,event_id,is_active&order=position.asc`, { headers: H })
  const links = eRes.ok ? await eRes.json() : []
  const byCamp = new Map()
  for (const l of links) {
    if (!l.is_active) continue
    const ev = eventsById.get(l.event_id)
    if (!ev) continue // jen publikované události (mají detail stránku)
    if (!byCamp.has(l.campaign_id)) byCamp.set(l.campaign_id, [])
    byCamp.get(l.campaign_id).push(ev)
  }
  for (const c of campaigns) {
    c.slug = c.slug || slugify(c.title) || `kampan-${c.id.slice(0, 8)}`
    c.events = byCamp.get(c.id) || []
  }
  return campaigns.filter((c) => c.events.length) // bez kol nemá smysl generovat
}

/** Doplní chybějící slugy lokálně (kdyby migrace ještě neproběhla), aby build nepadal. */
function ensureSlugs(events) {
  const used = { base: new Set(), en: new Set(), de: new Set() }
  const uniq = (s, set, fb) => {
    let v = slugify(s) || fb
    if (set.has(v)) { let n = 2; while (set.has(`${v}-${n}`)) n++; v = `${v}-${n}` }
    set.add(v); return v
  }
  // 1. průchod: zaregistruj už perzistované slugy jako obsazené
  for (const ev of events) {
    if (ev.slug) used.base.add(ev.slug)
    if (ev.slug_en) used.en.add(ev.slug_en)
    if (ev.slug_de) used.de.add(ev.slug_de)
  }
  // 2. průchod: doplň chybějící (unikátní vůči obsazeným)
  for (const ev of events) {
    if (!ev.slug) ev.slug = uniq(ev.title, used.base, `udalost-${ev.seq}`)
    if (!ev.slug_en) ev.slug_en = uniq(ev.title_en || ev.title, used.en, ev.slug)
    if (!ev.slug_de) ev.slug_de = uniq(ev.title_de || ev.title, used.de, ev.slug)
  }
  return events
}

/** 4 související: stejná kategorie, nejbližší rok; doplní napříč kategoriemi. */
function relatedFor(ev, all) {
  const others = all.filter((e) => e.id !== ev.id)
  const sameCat = others.filter((e) => e.category === ev.category)
  const rest = others.filter((e) => e.category !== ev.category)
  const byYear = (a, b) => Math.abs((a.year ?? 0) - (ev.year ?? 0)) - Math.abs((b.year ?? 0) - (ev.year ?? 0))
  return [...sameCat.sort(byYear), ...rest.sort(byYear)].slice(0, 4)
}

function imgFor(ev) {
  return ev.preview_url || ev.event_image_url || ev.panorama_url || ''
}

function storyHtml(story, desc, t) {
  // Delší příběh, jinak fallback na krátký popis rozdělený do odstavců.
  if (story) {
    const paras = story.odstavce.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n        ')
    const head = story.titulek ? `<p class="lede">${escapeHtml(story.titulek)}</p>\n        ` : ''
    return head + paras
  }
  const text = (desc || '').trim()
  if (!text) return `<p>${escapeHtml(t.tagline)}.</p>`
  return text.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p.trim())}</p>`).join('\n        ')
}

function jsonLd(ev, locale, canonicalUrl, cat) {
  const graph = [{
    '@type': ev.category === 'places' ? 'Place' : 'Event',
    name: eventTitleFor(ev, locale),
    description: eventDescriptionFor(ev, locale).slice(0, 300) || undefined,
    ...(ev.event_date ? { startDate: ev.event_date } : {}),
    url: canonicalUrl,
    ...(ev.lat != null && ev.lng != null ? {
      location: {
        '@type': 'Place',
        name: eventTitleFor(ev, locale),
        geo: { '@type': 'GeoCoordinates', latitude: ev.lat, longitude: ev.lng },
      },
    } : {}),
  }]
  return { '@context': 'https://schema.org', '@graph': graph }
}

function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path),
    })),
  }
}

function renderEvent(ev, locale, all) {
  const t = UI[locale]
  const seg = PATH_SEG[locale]
  const slug = eventSlugFor(ev, locale)
  const title = eventTitleFor(ev, locale)
  const desc = eventDescriptionFor(ev, locale)
  const story = eventStoryFor(ev, locale)
  const catKey = CATEGORY_KEYS.includes(ev.category) ? ev.category : null
  const cat = catKey ? CATEGORIES[catKey][locale] : null
  const path = eventPath(locale, slug)
  const canonical = abs(path)
  const yearLabel = formatYear(ev.year, locale)
  const period = ev.year_from != null && ev.year_to != null && ev.year_from !== ev.year_to
    ? `${formatYear(ev.year_from, locale)} – ${formatYear(ev.year_to, locale)}`
    : yearLabel
  const img = imgFor(ev)
  const metaTitle = `${title} — ${t.metaSuffix}`
  const metaDesc = (desc || `${title}. ${t.tagline}.`).slice(0, 300)

  // hreflang: každá jazyková varianta má vlastní slug
  const alternates = LOCALES.map((l) => ({
    l, href: abs(eventPath(l, eventSlugFor(ev, l))),
  }))

  const crumbs = [
    { name: t.home, path: `/${locale}` },
    { name: t.explore, path: exploreListPath(locale) },
    ...(cat ? [{ name: cat.label, path: categoryPath(locale, catKey) }] : []),
    { name: title, path },
  ]

  const related = relatedFor(ev, all).map((r) => {
    const rSlug = eventSlugFor(r, locale)
    const rImg = imgFor(r)
    return `
          <a class="rel-card" href="${eventPath(locale, rSlug)}">
            ${rImg ? `<img loading="lazy" src="${escapeHtml(rImg)}" alt="">` : ''}
            <div class="rel-body">
              <span class="rel-year">${escapeHtml(formatYear(r.year, locale))}</span>
              <span class="rel-title">${escapeHtml(eventTitleFor(r, locale))}</span>
            </div>
          </a>`
  }).join('')

  const ld = [jsonLd(ev, locale, canonical, cat), breadcrumbLd(crumbs)]

  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escapeHtml(metaTitle)}</title>
  <meta name="description" content="${escapeHtml(metaDesc)}" />
  <link rel="canonical" href="${canonical}" />
  ${alternates.map((a) => `<link rel="alternate" hreflang="${a.l}" href="${a.href}" />`).join('\n  ')}
  <link rel="alternate" hreflang="x-default" href="${abs(eventPath('cs', eventSlugFor(ev, 'cs')))}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(metaDesc)}" />
  <meta property="og:url" content="${canonical}" />
  ${img ? `<meta property="og:image" content="${escapeHtml(img)}" />` : ''}
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..500&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/explore.css" />
  <script type="application/ld+json">
${ld.map((x) => JSON.stringify(x, null, 2)).join('\n')}
  </script>
</head>
<body class="xp">
  <header class="xp-hero" ${img ? `style="--hero-img:url('${escapeHtml(img)}')"` : ''}>
    <div class="xp-hero-scrim"></div>
    <nav class="xp-topbar" aria-label="${escapeHtml(t.explore)}">
      <a class="xp-logo" href="/${locale}"><span class="xp-logo-mark"></span> Historyguesser</a>
      <a class="xp-btn-ghost" href="${exploreListPath(locale)}">${escapeHtml(t.explore_cta)}</a>
    </nav>
    <div class="xp-hero-inner">
      <nav class="xp-breadcrumb" aria-label="breadcrumb">
        ${crumbs.map((c, i) => i < crumbs.length - 1
          ? `<a href="${c.path}">${escapeHtml(c.name)}</a><span aria-hidden="true">/</span>`
          : `<span aria-current="page">${escapeHtml(c.name)}</span>`).join('\n        ')}
      </nav>
      <h1>${escapeHtml(title)}</h1>
      <div class="xp-hero-meta">
        ${yearLabel ? `<span>${escapeHtml(yearLabel)}</span>` : ''}
        ${cat ? `<span class="xp-cat">${escapeHtml(cat.label)}</span>` : ''}
      </div>
    </div>
  </header>

  <main class="xp-main">
    <article class="xp-article">
      <h2>${escapeHtml(t.whatHappened)}</h2>
      <div class="xp-prose">
        ${storyHtml(story, desc, t)}
      </div>

      ${related ? `<section class="xp-related">
        <h2>${escapeHtml(t.related)}</h2>
        <div class="rel-grid">${related}
        </div>
      </section>` : ''}
    </article>

    <aside class="xp-side">
      <div class="xp-facts">
        <div class="xp-facts-title">${escapeHtml(t.facts)}</div>
        <dl>
          ${ev.event_date ? `<dt>${escapeHtml(t.dateL)}</dt><dd>${escapeHtml(ev.event_date)}</dd>` : ''}
          ${period ? `<dt>${escapeHtml(t.periodL)}</dt><dd>${escapeHtml(period)}</dd>` : ''}
          ${cat ? `<dt>${escapeHtml(t.categoryL)}</dt><dd>${escapeHtml(cat.label)}</dd>` : ''}
        </dl>
        <a class="xp-btn-primary" href="${playEventPath(ev.id)}">${escapeHtml(t.play)}</a>
        <p class="xp-recon">${escapeHtml(t.reconstruction)}</p>
      </div>
    </aside>
  </main>

${footerHtml(locale)}
</body>
</html>
`
}

// ── Výpis (Objevuj historii) + kategorie ────────────────────────────────────
function renderCard(ev, locale, t) {
  const slug = eventSlugFor(ev, locale)
  const img = imgFor(ev)
  const catKey = CATEGORY_KEYS.includes(ev.category) ? ev.category : null
  const cat = catKey ? CATEGORIES[catKey][locale] : null
  return `
        <a class="ev-card" href="${eventPath(locale, slug)}">
          <div class="ev-thumb">${img ? `<img loading="lazy" src="${escapeHtml(img)}" alt="">` : ''}</div>
          <div class="ev-body">
            <span class="ev-meta">${escapeHtml(formatYear(ev.year, locale))}${cat ? ` · ${escapeHtml(cat.label)}` : ''}</span>
            <span class="ev-title">${escapeHtml(eventTitleFor(ev, locale))}</span>
            <span class="ev-more">${escapeHtml(t.playCta)} →</span>
          </div>
        </a>`
}

function renderListing(locale, all, catKey) {
  const t = UI[locale]
  const cat = catKey ? CATEGORIES[catKey][locale] : null
  const path = catKey ? categoryPath(locale, catKey) : exploreListPath(locale)
  const canonical = abs(path)
  const list = catKey ? all.filter((e) => e.category === catKey) : all
  const h1 = cat ? cat.label : t.listH1
  const metaTitle = `${h1} — ${t.metaSuffix}`
  const metaDesc = cat ? `${t.catMetaPrefix} ${cat.label}. ${t.listSub}` : t.listMeta

  // hreflang varianty téže stránky
  const alternates = LOCALES.map((l) => ({
    l, href: abs(catKey ? categoryPath(l, catKey) : exploreListPath(l)),
  }))

  const crumbs = [
    { name: t.home, path: `/${locale}` },
    { name: t.explore, path: exploreListPath(locale) },
    ...(cat ? [{ name: cat.label, path }] : []),
  ]

  // Filtr = odkazy na kategorie (indexovatelné). Aktivní = aktuální.
  const counts = {}
  for (const e of all) if (CATEGORY_KEYS.includes(e.category)) counts[e.category] = (counts[e.category] || 0) + 1
  const chips = [
    `<a class="chip${!catKey ? ' is-active' : ''}" href="${exploreListPath(locale)}">${escapeHtml(t.allCats)} <span>${all.length}</span></a>`,
    ...CATEGORY_KEYS.filter((k) => counts[k]).map((k) =>
      `<a class="chip${catKey === k ? ' is-active' : ''}" href="${categoryPath(locale, k)}">${escapeHtml(CATEGORIES[k][locale].label)} <span>${counts[k]}</span></a>`),
  ].join('\n          ')

  const cards = list.map((e) => renderCard(e, locale, t)).join('')

  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: h1, url: canonical, description: metaDesc,
      inLanguage: locale,
    },
    breadcrumbLd(crumbs),
    {
      '@context': 'https://schema.org', '@type': 'ItemList',
      numberOfItems: list.length,
      itemListElement: list.slice(0, 100).map((e, i) => ({
        '@type': 'ListItem', position: i + 1,
        url: abs(eventPath(locale, eventSlugFor(e, locale))),
        name: eventTitleFor(e, locale),
      })),
    },
  ]

  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escapeHtml(metaTitle)}</title>
  <meta name="description" content="${escapeHtml(metaDesc)}" />
  <link rel="canonical" href="${canonical}" />
  ${alternates.map((a) => `<link rel="alternate" hreflang="${a.l}" href="${a.href}" />`).join('\n  ')}
  <link rel="alternate" hreflang="x-default" href="${abs(catKey ? categoryPath('cs', catKey) : exploreListPath('cs'))}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(h1)}" />
  <meta property="og:description" content="${escapeHtml(metaDesc)}" />
  <meta property="og:url" content="${canonical}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..500&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/explore.css" />
  <script type="application/ld+json">
${ld.map((x) => JSON.stringify(x, null, 2)).join('\n')}
  </script>
</head>
<body class="xp">
  <header class="xp-hero xp-hero-list">
    <div class="xp-hero-scrim"></div>
    <nav class="xp-topbar" aria-label="${escapeHtml(t.explore)}">
      <a class="xp-logo" href="/${locale}"><span class="xp-logo-mark"></span> Historyguesser</a>
      <a class="xp-btn-ghost" href="/${locale}">${escapeHtml(t.home)}</a>
    </nav>
    <div class="xp-hero-inner">
      <nav class="xp-breadcrumb" aria-label="breadcrumb">
        ${crumbs.map((c, i) => i < crumbs.length - 1
          ? `<a href="${c.path}">${escapeHtml(c.name)}</a><span aria-hidden="true">/</span>`
          : `<span aria-current="page">${escapeHtml(c.name)}</span>`).join('\n        ')}
      </nav>
      <h1>${escapeHtml(h1)}</h1>
      <p class="xp-hero-sub">${escapeHtml(cat ? t.listSub : t.listSub)}</p>
    </div>
  </header>

  <main class="xp-list-main">
    <nav class="xp-filters" aria-label="${escapeHtml(t.filterBy)}">
      ${chips}
    </nav>
    <div class="xp-count">${list.length} ${escapeHtml(t.explore_word)}</div>
    <div class="ev-grid">${cards}
    </div>
  </main>

${footerHtml(locale)}
</body>
</html>
`
}

// ── Veřejná homepage (panorama na pozadí + rozcestník) ──────────────────────
function renderHome(locale, all) {
  const t = UI[locale]
  const canonical = abs(`/${locale}`)
  const withImg = all.filter((e) => imgFor(e))
  const heroEv = withImg[0] || all[0]
  const heroImg = heroEv ? (heroEv.panorama_url || imgFor(heroEv)) : ''
  const featured = withImg.slice(0, 3)

  const alternates = LOCALES.map((l) => ({ l, href: abs(`/${l}`) }))
  const metaTitle = `${t.metaSuffix} — ${t.tagline}`

  const ld = [{
    '@context': 'https://schema.org', '@type': 'WebSite',
    name: 'Historyguesser', url: canonical, inLanguage: locale,
    description: t.homeMeta,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${abs(exploreListPath(locale))}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }]

  const steps = t.steps.map(([h, d], i) => `
          <div class="how-step">
            <span class="how-num">${String(i + 1).padStart(2, '0')}</span>
            <h3>${escapeHtml(h)}</h3>
            <p>${escapeHtml(d)}</p>
          </div>`).join('')

  const cards = featured.map((e) => renderCard(e, locale, t)).join('')

  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escapeHtml(metaTitle)}</title>
  <meta name="description" content="${escapeHtml(t.homeMeta)}" />
  <link rel="canonical" href="${canonical}" />
  ${alternates.map((a) => `<link rel="alternate" hreflang="${a.l}" href="${a.href}" />`).join('\n  ')}
  <link rel="alternate" hreflang="x-default" href="${abs('/cs')}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(metaTitle)}" />
  <meta property="og:description" content="${escapeHtml(t.homeSub)}" />
  <meta property="og:url" content="${canonical}" />
  ${heroImg ? `<meta property="og:image" content="${escapeHtml(heroImg)}" />` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..500&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/explore.css" />
  <script type="application/ld+json">
${ld.map((x) => JSON.stringify(x, null, 2)).join('\n')}
  </script>
</head>
<body class="xp">
  <header class="xp-home-hero">
    ${heroImg ? `<img class="xp-pan" src="${escapeHtml(heroImg)}" alt="" aria-hidden="true">` : ''}
    <div class="xp-hero-scrim"></div>
    <nav class="xp-topbar" aria-label="Historyguesser">
      <a class="xp-logo" href="/${locale}"><span class="xp-logo-mark"></span> Historyguesser</a>
      <div class="xp-nav-right">
        <a class="xp-btn-ghost" href="${exploreListPath(locale)}">${escapeHtml(t.explore_cta)}</a>
        <a class="xp-btn-primary xp-btn-sm" href="/menu">${escapeHtml(t.homePlay)}</a>
      </div>
    </nav>
    <div class="xp-home-inner">
      <span class="xp-kicker">${escapeHtml(t.homeKicker)}</span>
      <h1>${escapeHtml(t.homeH1)}</h1>
      <p class="xp-home-sub">${escapeHtml(t.homeSub)}</p>
      <div class="xp-cta-row">
        <a class="xp-btn-primary" href="/menu">${escapeHtml(t.homePlay)}</a>
        <a class="xp-btn-ghost" href="${exploreListPath(locale)}">${escapeHtml(t.explore_cta)}</a>
      </div>
    </div>
    <a class="xp-home-strip" href="${exploreListPath(locale)}">↓ ${all.length} ${escapeHtml(t.explore_word)} ${escapeHtml(t.homeBrowse)}</a>
  </header>

  <section class="xp-section">
    <div class="xp-section-inner">
      <h2>${escapeHtml(t.howTitle)}</h2>
      <div class="how-grid">${steps}
      </div>
    </div>
  </section>

  <section class="xp-section xp-section-sunk">
    <div class="xp-section-inner">
      <div class="xp-section-head">
        <h2>${escapeHtml(t.featuredTitle)}</h2>
        <a class="xp-more-link" href="${exploreListPath(locale)}">${escapeHtml(t.explore_cta)} →</a>
      </div>
      <div class="ev-grid">${cards}
      </div>
    </div>
  </section>

${footerHtml(locale)}
</body>
</html>
`
}

// ── Statická stránka (O projektu / Jak hrát) ────────────────────────────────
function staticPath(locale, pageKey) {
  return `/${locale}/${STATIC[locale][pageKey].slug}`
}

// Sdílená patička se stejnými odkazy na všech stránkách (prolinkování).
function footerHtml(locale) {
  const t = UI[locale]
  return `  <footer class="xp-footer">
    <nav class="xp-footer-links" aria-label="footer">
      <a href="${exploreListPath(locale)}">${escapeHtml(t.explore_cta)}</a>
      <a href="${staticPath(locale, 'howto')}">${escapeHtml(STATIC[locale].howto.title)}</a>
      <a href="${staticPath(locale, 'about')}">${escapeHtml(STATIC[locale].about.title)}</a>
    </nav>
    <div class="xp-footer-brand"><a href="/${locale}">Historyguesser</a> · ${escapeHtml(t.tagline)}</div>
  </footer>`
}

function renderStaticPage(locale, pageKey) {
  const t = UI[locale]
  const page = STATIC[locale][pageKey]
  const path = staticPath(locale, pageKey)
  const canonical = abs(path)
  const metaTitle = `${page.title} — ${t.metaSuffix}`
  const metaDesc = page.lead.slice(0, 300)

  const alternates = LOCALES.map((l) => ({ l, href: abs(staticPath(l, pageKey)) }))
  const crumbs = [
    { name: t.home, path: `/${locale}` },
    { name: page.title, path },
  ]
  const body = page.sections.map(([h, paras]) => `
        <h2>${escapeHtml(h)}</h2>
        ${paras.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n        ')}`).join('\n')

  const ld = [
    { '@context': 'https://schema.org', '@type': 'AboutPage', name: page.title, url: canonical, inLanguage: locale, description: metaDesc },
    breadcrumbLd(crumbs),
  ]

  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escapeHtml(metaTitle)}</title>
  <meta name="description" content="${escapeHtml(metaDesc)}" />
  <link rel="canonical" href="${canonical}" />
  ${alternates.map((a) => `<link rel="alternate" hreflang="${a.l}" href="${a.href}" />`).join('\n  ')}
  <link rel="alternate" hreflang="x-default" href="${abs(staticPath('cs', pageKey))}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(page.title)}" />
  <meta property="og:description" content="${escapeHtml(metaDesc)}" />
  <meta property="og:url" content="${canonical}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..500&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/explore.css" />
  <script type="application/ld+json">
${ld.map((x) => JSON.stringify(x, null, 2)).join('\n')}
  </script>
</head>
<body class="xp">
  <header class="xp-hero xp-hero-doc">
    <div class="xp-hero-scrim"></div>
    <nav class="xp-topbar" aria-label="Historyguesser">
      <a class="xp-logo" href="/${locale}"><span class="xp-logo-mark"></span> Historyguesser</a>
      <a class="xp-btn-primary xp-btn-sm" href="/menu">${escapeHtml(t.homePlay)}</a>
    </nav>
    <div class="xp-hero-inner">
      <nav class="xp-breadcrumb" aria-label="breadcrumb">
        ${crumbs.map((c, i) => i < crumbs.length - 1
          ? `<a href="${c.path}">${escapeHtml(c.name)}</a><span aria-hidden="true">/</span>`
          : `<span aria-current="page">${escapeHtml(c.name)}</span>`).join('\n        ')}
      </nav>
      <h1>${escapeHtml(page.title)}</h1>
    </div>
  </header>

  <main class="xp-doc-main">
    <p class="xp-doc-lead">${escapeHtml(page.lead)}</p>
    <div class="xp-prose">${body}
    </div>
  </main>

${footerHtml(locale)}
</body>
</html>
`
}

// ── Detail kampaně ──────────────────────────────────────────────────────────
function campTitleFor(c, locale) {
  if (locale === 'en') return c.title_en || c.title
  if (locale === 'de') return c.title_de || c.title
  return c.title
}
function campDescFor(c, locale) {
  if (locale === 'en') return c.description_en || c.description || ''
  if (locale === 'de') return c.description_de || c.description || ''
  return c.description || ''
}

function renderCampaign(locale, c, all) {
  const t = UI[locale]
  const seg = PATH_SEG[locale]
  const title = campTitleFor(c, locale)
  const desc = campDescFor(c, locale)
  const path = campaignPath(locale, c.slug)
  const canonical = abs(path)
  const img = c.visual_url || (c.events[0] ? imgFor(c.events[0]) : '')
  const metaTitle = `${title} — ${t.metaSuffix}`
  const metaDesc = (desc || `${title}. ${t.tagline}.`).slice(0, 300)

  const alternates = LOCALES.map((l) => ({ l, href: abs(campaignPath(l, c.slug)) }))
  const crumbs = [
    { name: t.home, path: `/${locale}` },
    { name: t.campaignsTitle, path: exploreListPath(locale) },
    { name: title, path },
  ]

  const timeline = c.events.map((ev, i) => {
    const slug = eventSlugFor(ev, locale)
    const evImg = imgFor(ev)
    return `
          <a class="camp-round" href="${eventPath(locale, slug)}">
            <span class="camp-round-num">${String(i + 1).padStart(2, '0')}</span>
            <div class="camp-round-thumb">${evImg ? `<img loading="lazy" src="${escapeHtml(evImg)}" alt="">` : ''}</div>
            <div class="camp-round-body">
              <span class="camp-round-meta">${escapeHtml(formatYear(ev.year, locale))}</span>
              <span class="camp-round-title">${escapeHtml(eventTitleFor(ev, locale))}</span>
              <span class="camp-round-more">${escapeHtml(t.playCta)} →</span>
            </div>
          </a>`
  }).join('')

  const prose = desc.trim()
    ? desc.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p.trim())}</p>`).join('\n        ')
    : ''

  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'Course',
      name: title, description: metaDesc, url: canonical, inLanguage: locale,
      provider: { '@type': 'Organization', name: 'Historyguesser' },
    },
    breadcrumbLd(crumbs),
    {
      '@context': 'https://schema.org', '@type': 'ItemList',
      numberOfItems: c.events.length,
      itemListElement: c.events.map((ev, i) => ({
        '@type': 'ListItem', position: i + 1,
        url: abs(eventPath(locale, eventSlugFor(ev, locale))),
        name: eventTitleFor(ev, locale),
      })),
    },
  ]

  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escapeHtml(metaTitle)}</title>
  <meta name="description" content="${escapeHtml(metaDesc)}" />
  <link rel="canonical" href="${canonical}" />
  ${alternates.map((a) => `<link rel="alternate" hreflang="${a.l}" href="${a.href}" />`).join('\n  ')}
  <link rel="alternate" hreflang="x-default" href="${abs(campaignPath('cs', c.slug))}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(metaDesc)}" />
  <meta property="og:url" content="${canonical}" />
  ${img ? `<meta property="og:image" content="${escapeHtml(img)}" />` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..500&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/explore.css" />
  <script type="application/ld+json">
${ld.map((x) => JSON.stringify(x, null, 2)).join('\n')}
  </script>
</head>
<body class="xp">
  <header class="xp-hero" ${img ? `style="--hero-img:url('${escapeHtml(img)}')"` : ''}>
    <div class="xp-hero-scrim"></div>
    <nav class="xp-topbar" aria-label="Historyguesser">
      <a class="xp-logo" href="/${locale}"><span class="xp-logo-mark"></span> Historyguesser</a>
      <a class="xp-btn-primary xp-btn-sm" href="/menu">${escapeHtml(t.campPlay)}</a>
    </nav>
    <div class="xp-hero-inner">
      <nav class="xp-breadcrumb" aria-label="breadcrumb">
        ${crumbs.map((cc, i) => i < crumbs.length - 1
          ? `<a href="${cc.path}">${escapeHtml(cc.name)}</a><span aria-hidden="true">/</span>`
          : `<span aria-current="page">${escapeHtml(cc.name)}</span>`).join('\n        ')}
      </nav>
      <span class="xp-kicker">${escapeHtml(t.campKicker)}</span>
      <h1>${escapeHtml(title)}</h1>
      <div class="xp-hero-meta"><span>${c.events.length} ${escapeHtml(t.campRounds)}</span></div>
    </div>
  </header>

  <main class="xp-doc-main">
    ${prose ? `<div class="xp-prose">\n        ${prose}\n    </div>` : ''}
    <h2 class="camp-timeline-title">${escapeHtml(t.campTimeline)}</h2>
    <div class="camp-timeline">${timeline}
    </div>
    <div class="camp-cta"><a class="xp-btn-primary" href="/menu">${escapeHtml(t.campPlay)}</a></div>
  </main>

${footerHtml(locale)}
</body>
</html>
`
}

// ── Běh ─────────────────────────────────────────────────────────────────────
if (!existsSync(dist)) {
  console.error('[explore] dist/ nenalezen — spusť po `vite build`.')
  process.exit(1)
}

let events
try {
  events = ensureSlugs(await fetchEvents())
} catch (err) {
  console.error(`[explore] Nepodařilo se načíst události: ${err.message}`)
  console.error('[explore] Přeskakuji generování Explore stránek (build pokračuje).')
  process.exit(0) // nebfoukat celý build kvůli výpadku sítě
}

const sitemap = []
let count = 0
for (const ev of events) {
  for (const locale of LOCALES) {
    const html = renderEvent(ev, locale, events)
    const slug = eventSlugFor(ev, locale)
    const outDir = resolve(dist, locale, PATH_SEG[locale].events, slug)
    mkdirSync(outDir, { recursive: true })
    writeFileSync(resolve(outDir, 'index.html'), html, 'utf8')
    sitemap.push({ loc: abs(eventPath(locale, slug)), lastmod: new Date().toISOString().slice(0, 10) })
    count++
  }
}

// Veřejná homepage per jazyk (/cs, /en, /de) — nahrazuje i18n shelly bohatým obsahem
for (const locale of LOCALES) {
  const homeDir = resolve(dist, locale)
  mkdirSync(homeDir, { recursive: true })
  writeFileSync(resolve(homeDir, 'index.html'), renderHome(locale, events), 'utf8')
  sitemap.push({ loc: abs(`/${locale}`), lastmod: new Date().toISOString().slice(0, 10) })
}

// Kampaně (vyžadují migraci 20260821140000 — jinak fetchCampaigns vrátí [])
const eventsById = new Map(events.map((e) => [e.id, e]))
let campaigns = []
try { campaigns = await fetchCampaigns(eventsById) } catch (err) { console.warn(`[explore] Kampaně: ${err.message}`) }
// Dev-only náhled šablony kampaně bez přístupu k datům: EXPLORE_MOCK_CAMPAIGN=1
if (!campaigns.length && process.env.EXPLORE_MOCK_CAMPAIGN) {
  campaigns = [{
    id: 'mock', slug: 'ukazkova-kampan',
    title: 'Vzestup a pád Napoleona', title_en: 'Rise and Fall of Napoleon', title_de: 'Aufstieg und Fall Napoleons',
    description: 'Od dělostřeleckého důstojníka k císaři a zpět do exilu. Pět okamžiků, které vystihují jednu z nejrychlejších politických drah v dějinách Evropy.\n\nKaždé kolo tě postaví na jedno z míst Napoleonova příběhu — od bitev po podepsané smlouvy.',
    events: events.slice(0, 5),
  }]
  console.warn('[explore] MOCK kampaň vygenerována (jen pro náhled šablony).')
}
let campCount = 0
for (const c of campaigns) {
  for (const locale of LOCALES) {
    const dir = resolve(dist, locale, PATH_SEG[locale].campaigns, c.slug)
    mkdirSync(dir, { recursive: true })
    writeFileSync(resolve(dir, 'index.html'), renderCampaign(locale, c, events), 'utf8')
    sitemap.push({ loc: abs(campaignPath(locale, c.slug)), lastmod: new Date().toISOString().slice(0, 10) })
    campCount++
  }
}

// Statické stránky (O projektu, Jak hrát)
let staticCount = 0
for (const locale of LOCALES) {
  for (const pageKey of ['about', 'howto']) {
    const dir = resolve(dist, locale, STATIC[locale][pageKey].slug)
    mkdirSync(dir, { recursive: true })
    writeFileSync(resolve(dir, 'index.html'), renderStaticPage(locale, pageKey), 'utf8')
    sitemap.push({ loc: abs(staticPath(locale, pageKey)), lastmod: new Date().toISOString().slice(0, 10) })
    staticCount++
  }
}

// Výpis + kategorie (indexovatelné rozcestníky)
const usedCats = new Set(events.map((e) => e.category).filter((c) => CATEGORY_KEYS.includes(c)))
let listCount = 0
for (const locale of LOCALES) {
  // hlavní výpis
  const listDir = resolve(dist, locale, PATH_SEG[locale].explore)
  mkdirSync(listDir, { recursive: true })
  writeFileSync(resolve(listDir, 'index.html'), renderListing(locale, events, null), 'utf8')
  sitemap.push({ loc: abs(exploreListPath(locale)), lastmod: new Date().toISOString().slice(0, 10) })
  listCount++
  // kategorie
  for (const key of CATEGORY_KEYS) {
    if (!usedCats.has(key)) continue
    const catDir = resolve(dist, locale, PATH_SEG[locale].explore, CATEGORIES[key][locale].slug)
    mkdirSync(catDir, { recursive: true })
    writeFileSync(resolve(catDir, 'index.html'), renderListing(locale, events, key), 'utf8')
    sitemap.push({ loc: abs(categoryPath(locale, key)), lastmod: new Date().toISOString().slice(0, 10) })
    listCount++
  }
}

// explore.css → dist (statické stránky ho linkují z /explore.css)
const cssSrc = resolve(root, 'src/styles/explore.css')
if (existsSync(cssSrc)) copyFileSync(cssSrc, resolve(dist, 'explore.css'))

// sitemap.xml
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`
writeFileSync(resolve(dist, 'sitemap.xml'), sitemapXml, 'utf8')

// robots.txt (nepřepisuj, pokud už existuje s víc pravidly — přidej sitemap)
const robotsPath = resolve(dist, 'robots.txt')
let robots = existsSync(robotsPath) ? readFileSync(robotsPath, 'utf8') : 'User-agent: *\nAllow: /\n'
if (!robots.includes('Sitemap:')) robots += `Sitemap: ${SITE_ORIGIN}/sitemap.xml\n`
writeFileSync(robotsPath, robots, 'utf8')

console.log(`[explore] ✓ ${events.length} událostí × ${LOCALES.length} jazyky = ${count} stránek`)
console.log(`[explore] ✓ výpis + kategorie = ${listCount} stránek`)
if (campCount) console.log(`[explore] ✓ kampaně = ${campCount} stránek (${campaigns.length} × ${LOCALES.length})`)
console.log(`[explore] ✓ sitemap.xml (${sitemap.length} URL), robots.txt`)
