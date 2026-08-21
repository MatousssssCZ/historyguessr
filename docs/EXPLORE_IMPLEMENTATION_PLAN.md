# Explore History — implementační plán

> Plán zavedení veřejné obsahové vrstvy „Objevuj historii" podle handoffu Claude Design
> (`design_handoff_explore/`). Cíl: vyřešit AdSense „low value" tím, že každá událost,
> kampaň a kategorie dostane vlastní **veřejnou URL se skutečným, robotem čitelným textem**
> — a přitom zachovat hierarchii **hra → objevování → obsah → monetizace**.

---

## 0. TL;DR — doporučení

| Rozhodnutí | Doporučení | Proč |
|---|---|---|
| **Pre-rendering** | **Build-time SSG** rozšířením `scripts/build-i18n-pages.mjs` | Už ten pattern máte. Zůstává Vite + Vercel, **nulové náklady navíc**, žádná migrace na Next.js. |
| **Design systém** | `--hg-*` tokeny zavést jako **vrstvu jen pro veřejné stránky**, appka zůstává na stávajících tokenech (zatím) | Nemíchat dvě identity v jedné obrazovce. Sblížení appky s novým vzhledem řešit později, samostatně. |
| **První krok** | **Datový model slugů + pilot: detail události** | Nejsilnější SEO stránka. Ověří celý řetězec (data → build → HTML → Vercel) na jedné obrazovce. |
| **Aktualizace obsahu** | Vercel **Deploy Hook** volaný z adminu po publikaci + denní cron rebuild | Statické HTML se obnoví při deploji; admin si sáhne na tlačítko „Přegenerovat web". |

**Proč ne SSR / Next.js:** vaše appka je Vite SPA a Google ji označil za „low value", protože
robot viděl prázdné `#root`. Nepotřebujete ale renderovat za běhu — obsah (události) se mění
zřídka. Statické HTML vygenerované při buildu je pro tohle ideální: rychlé, levné, robustní,
a **přesně na to už máte hotovou kostru** (`build-i18n-pages.mjs` + `vercel.json` rewrites).

---

## 1. Architektura: dvě vrstvy, jeden web

```
┌─ VEŘEJNÉ STATICKÉ STRÁNKY (SSG, indexovatelné) ─────────────┐
│ /cs/udalosti/{slug}      detail události  ← nejdůležitější   │
│ /cs/kampane/{slug}       detail kampaně                      │
│ /cs/objevuj             výpis + filtry                       │
│ /cs/objevuj/{kategorie} kategorie                            │
│ /cs/jak-hrat /o-projektu /kontakt                            │
│ (+ /en/… /de/… se stejnou strukturou, lokalizované slugy)   │
│                                                              │
│ Každá = reálné HTML s <h1>, texty, JSON-LD, breadcrumbs.     │
│ Z každé je „Hrát" na 1 klik → vstup do SPA.                  │
└──────────────────────────────────────────────────────────────┘
             ↕  „Hrát" / „Zahrát tuto událost"
┌─ SPA APLIKACE (dnešní hra, za loginem i bez) ───────────────┐
│ /menu /play /game /daily /multiplayer/... /stats /admin/...  │
│ React Router, dynamické, není potřeba indexovat.             │
└──────────────────────────────────────────────────────────────┘
```

**Jak to Vercel rozliší** (rozšíření dnešního `vercel.json`):
1. konkrétní statické cesty (`/cs/udalosti/*`, `/cs/objevuj*`, `/en/*`, `/de/*` …) → statické HTML soubory z `dist/`
2. `/(.*)` fallback → `/index.html` (SPA) — beze změny

> Pozn.: dnešní SPA běží na kořeni `/` (bez `/cs`). Veřejná vrstva zavádí `/cs/` prefix.
> Rozhodnout: buď appku necháme na `/` a jen obsah dá pod `/cs|/en|/de`, nebo sjednotíme
> vše pod jazykové prefixy. **Doporučení:** nechat appku kde je, obsah přidat pod prefixy —
> menší zásah, žádné rozbité odkazy.

---

## 2. Datový model (slugy a obsah)

Slug sloupce už v typech existují (`events.slug`, `campaigns.slug`). Potřebujeme doplnit:

- **`events`**: ověřit/naplnit `slug` (unikátní, URL-safe), přidat lokalizované `slug_en`, `slug_de`
  (fallback na CZ slug). Volitelně `seo_intro` / delší text „Co se stalo / Proč to bylo důležité"
  (nebo generovat z `description*`).
- **`campaigns`**: totéž — `slug`, případně lokalizované.
- **kategorie**: dnes je `events.category` volný text/enum (`war/moments/places/...`). Pro
  `/cs/objevuj/valky-a-bitvy` potřebujeme mapu `kategorie → slug + název + popis` per jazyk
  (stačí konstanta v kódu, ne nová tabulka).
- **související události**: 4 návrhy = stejná kategorie / blízký rok / stejná kampaň (dopočítat při buildu).

**Migrace** (idempotentní, dle vašeho workflow): `add column if not exists slug_en/slug_de`,
backfill z názvů (slugifikace), unikátní index. Aplikace ručně na prod po lokálním testu.

---

## 3. Pre-rendering: jak konkrétně (SSG)

Nový build krok `scripts/build-explore-pages.mjs` (běží po `vite build`, vedle i18n-pages):

1. **Načte data z Supabase** (anon klient, jen publikované): události, kampaně, kategorie.
2. Pro každou entitu × jazyk vyrenderuje **statické HTML** z jedné šablony:
   - `<html lang>`, unikátní `<title>`, `meta description`
   - **jedno `<h1>`** = název události (ne wordmark)
   - `<h2>` sekce: Co se stalo / Proč to bylo důležité / Související
   - **JSON-LD** (`Event`/`Article` + `Place` se souřadnicemi; kampaň = `Course`/`ItemList`)
   - **breadcrumbs** (`<nav aria-label> + BreadcrumbList`)
   - canonical + **hreflang** trojice (cs/en/de) + `x-default`
   - prolinkování: 4 související + kampaň + kategorie
   - **„Zahrát tuto událost"** → hluboký odkaz do SPA
3. Zapíše do `dist/cs/udalosti/{slug}/index.html` atd.
4. Vygeneruje **`sitemap.xml`** (všechny veřejné URL, všechny jazyky) + aktualizuje `robots.txt`.

> Klíčové: obsah je v HTML **bez JS**. To je celý rozdíl proti dnešku. React se pak na stránce
> může „nabootovat" pro interaktivitu (mapa, hra), ale text tam je i pro robota.

**Data pro SPA i statické stránky = jeden zdroj** (Supabase), takže se nerozejdou.

---

## 4. Design systém (`--hg-*`) — jak zavést čistě

- Nový soubor `src/styles/explore.css` = obsah `tokens.css` z handoffu (`--hg-*`) + base pro
  veřejné stránky. **Načítá se jen na veřejných stránkách**, ne v herní appce.
- Fonty **Newsreader / Hanken Grotesk / JetBrains Mono** přidat přes Google Fonts (rozšířit CSP
  `font-src` a `style-src` — už tam `fonts.gstatic.com` je).
- Ikony **Phosphor** (handoff je používá) — přidat jako lokální subset, ne CDN (kvůli CSP a offline).
- Komponenty (tlačítka, karty, filtry, hlavička, tab bar) podle `komponenty.md` — **přesné hodnoty
  jsou tam**, stačí přepsat 1:1.

**Pravidlo:** dvě vrstvy nesměšovat na jedné obrazovce (tmavá = hra/hero/nav; světlá = čtení).
Homepage přechází z tmavé do světlé právě jednou (hero ⅔ výšky, pak 48px odstup).

**Kontrast (počítá se i pro AdSense kvalitu):** nejsvětlejší text na papíru `#6F6455` (5.4:1),
oranžová jako text `#A34E30` (ne `#BE6240`), hit areas ≥ 44px, respektovat `prefers-reduced-motion`.

---

## 5. Fáze implementace (návrh pořadí)

| Fáze | Obsah | Výstup |
|---|---|---|
| **F0 — základ** | migrace slugů, `explore.css` + fonty, sdílené komponenty (button/card/nav/footer), SSG skript kostra, Vercel rewrites | infrastruktura, nic veřejně vidět |
| **F1 — PILOT: detail události** | 1 šablona detailu + SSG generování + JSON-LD + sitemap; ověřit na prod, poslat Googlu | 412 indexovatelných stránek, důkaz konceptu |
| **F2 — výpis + kategorie** | `/cs/objevuj` s filtry (odkazy!), kompaktní mřížka, kategorie stránky | prolinkování + rozcestník |
| **F3 — detail kampaně** | šablona kampaně + timeline + prolinkování na 5 událostí | |
| **F4 — homepage (desktop+mobil)** | nová veřejná homepage dle `obrazovky.md`, hero ⅔ + světlé sekce | vstupní brána |
| **F5 — statické stránky** | Jak hrát, O projektu (zásadní pro AdSense — konkrétní, podepsané), Kontakt | důvěryhodnost pro review |
| **F6 — AdSense sloty** | `AdSlot` komponenta + umístění dle pravidel (výsledek kola, detail události) | monetizace, až web schválí |

**Výsledek kola → detail události** je nejsilnější přirozený vstup do obsahu — napojit brzy
(už ve F1/F2), i když je výsledek uvnitř SPA.

---

## 6. AdSense & SEO — závazná pravidla z handoffu

- **Reklama ANO:** výsledek kola (pod textem, nad „Pokračovat"), detail události, výpis.
  **NE:** login, registrace, loading, MP lobby, chybové/prázdné obrazovky.
- **Slot vzhled:** popisek `REKLAMA` (mono 9.5px `#6F6455`), plná linka nad i pod, podklad `#F3EDE2`,
  **bez rádiusu a stínu**, nikdy do 24px od CTA, nikdy nad záhybem homepage.
- **Transparentnost AI rekonstrukcí:** u každého panoramatu viditelná poznámka (mono 10px `#6F6455`),
  že jde o pravděpodobnou rekonstrukci; stránka O projektu to vysvětluje. Bez toho hrozí verdikt
  „zavádějící obsah".
- **Hierarchie nadpisů:** 1× `<h1>`/stránka; kickery jsou `<div>`, ne nadpisy.
- **Strukturovaná data:** událost `Event`/`Article`+`Place`; kampaň `Course`/`ItemList`; web `WebSite`+`SearchAction`.

---

## 7. Aktualizace obsahu (statické ≠ zamrzlé)

- **Vercel Deploy Hook**: admin dostane tlačítko „Přegenerovat web" (zavolá hook → rebuild → nové HTML).
- **Denní cron** (Vercel Cron nebo GitHub Action): 1× denně rebuild, aby se propsaly nové události
  i denní výzva bez ručního zásahu.
- Publikace nové události v adminu → nabídnout rovnou „přegenerovat".

---

## 8. Otevřené otázky (k rozhodnutí před F0)

1. **URL appky:** necháme SPA na `/` a obsah pod `/cs|/en|/de`? *(doporučení: ano)*
2. **Lokalizované slugy:** chceme `/en/events/battle-of-waterloo` (přeložený slug), nebo všude CZ slug?
   *(doporučení: přeložené slugy, fallback na CZ — lepší SEO v EN/DE)*
3. **Delší SEO texty:** generovat z dnešních `description*` (krátké), nebo doplnit delší „Co se stalo /
   Proč důležité" (AI + ruční revize v adminu)? *(handoff počítá s delším čtenářským textem)*
4. **Kdy zapnout reklamy** — až po schválení AdSense (dnes stav „Příprava").

---

## 9. Odhad rozsahu

Není to jeden commit — je to **feature na několik iterací**. Nejrychlejší hodnota: **F0 + F1**
(pilot detail události) — tím vznikne stovky indexovatelných stránek a otestuje se celý řetězec.
Zbytek (F2–F6) přidávat postupně, každou fázi zvlášť ověřit na prod a poslat Googlu.

**Navrhuji začít F0 + F1.** Než se do toho pustím, potřebuju od tebe rozhodnutí v sekci 8
(hlavně otázky 1–3).
