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
  eventPath, categoryPath, exploreListPath, abs, playEventPath,
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
  },
  en: {
    home: 'Home', explore: 'Explore history',
    whatHappened: 'What happened here?', whyImportant: 'Why did it matter?',
    related: 'Related events', facts: 'Facts', dateL: 'Date', placeL: 'Place',
    periodL: 'Period', categoryL: 'Category', play: 'Play this event',
    view360: 'View in 360°', explore_cta: 'Explore history',
    reconstruction: 'The panorama is a historically plausible reconstruction created with AI.',
    metaSuffix: 'Historyguesser', tagline: 'GeoGuessr for history',
  },
  de: {
    home: 'Start', explore: 'Geschichte entdecken',
    whatHappened: 'Was geschah hier?', whyImportant: 'Warum war es wichtig?',
    related: 'Verwandte Ereignisse', facts: 'Fakten', dateL: 'Datum', placeL: 'Ort',
    periodL: 'Epoche', categoryL: 'Kategorie', play: 'Dieses Ereignis spielen',
    view360: 'In 360° ansehen', explore_cta: 'Geschichte entdecken',
    reconstruction: 'Das Panorama ist eine historisch plausible, mit KI erstellte Rekonstruktion.',
    metaSuffix: 'Historyguesser', tagline: 'GeoGuessr für Geschichte',
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

  <footer class="xp-footer">
    <a href="/${locale}">Historyguesser</a> · ${escapeHtml(t.tagline)}
  </footer>
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
console.log(`[explore] ✓ sitemap.xml (${sitemap.length} URL), robots.txt`)
