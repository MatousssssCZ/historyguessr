# HistoryGuessr — kontext pro ChatGPT

> Tento soubor je samostatný briefing. ChatGPT nemá přístup ke kódu ani k databázi —
> všechno podstatné je popsané tady, aby se s ním dalo věcně diskutovat o produktu
> i technických rozhodnutích.

---

## 1. Co to je (elevator pitch)

**HistoryGuessr** je vzdělávací geolokační hra inspirovaná GeoGuessrem, ale s historickým
rozměrem. Hráč vidí **360° panorama historického místa** a hádá:
1. **kde na světě** se nachází (klikne do mapy),
2. **v jakém roce** se událost odehrála (posuvník −3000 až 2025).

Za přesnost dostává body. Cílem je zábavnou formou učit historii a zeměpis.

- **Live:** https://historyguessr.vercel.app
- **Hosting:** Vercel (auto-deploy z větve `main`)
- **Stav:** funkční MVP v produkci, aktivně se vyvíjí.

---

## 2. Herní režimy

| Režim | Popis |
|-------|-------|
| **Sólo hra** | 3 / 5 / 10 kol, filtrování podle kategorií a rozsahu let. Po každém kole výsledek (mapa tip vs. realita + bodování). |
| **Denní výzva** („Tento den v historii") | 1 kolo denně, časový limit 60 s, 1 pokus za den, žebříček + histogram skóre. |
| **Multiplayer** | Místnost na 5místný kód, až 12 hráčů, real-time synchronizace přes Supabase. Kola se synchronizují časově, žebříček kola i celkový. |

---

## 3. Cílová skupina / účel

- Vzdělávací nástroj (školy, jednotlivci se zájmem o historii).
- Hratelné na mobilu i desktopu (mobile-first UI).
- Lokalizováno do **češtiny, angličtiny a němčiny** (UI i popisy událostí).

---

## 4. Technický stack

| Vrstva | Technologie |
|--------|-------------|
| Frontend | React 18 + Vite + TypeScript |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime + RPC funkce) |
| Mapy | Leaflet.js + CartoDB Voyager dlaždice |
| 360° panorama | Pannellum.js (equirektangulární) |
| Styling | CSS proměnné + inline styly (žádný UI framework) |
| i18n | react-i18next (CS/EN/DE, auto-detekce z prohlížeče) |
| Deploy | GitHub → Vercel CI/CD |

Žádný vlastní server — veškerá logika je buď v klientovi, nebo v Supabase
(PostgreSQL funkce / RLS politiky). Skóre v multiplayeru počítá **server**
(databázová funkce), aby se nedalo podvádět.

---

## 5. Datový model (zjednodušeně)

- **events** — historická událost: název + popis (vč. EN/DE překladů), `year_from`/`year_to`
  (rozsah pro bodování; stejné číslo = přesný rok), volitelné přesné datum (`event_date`,
  pro denní výzvu), souřadnice, panorama (+ malý náhled pro okamžité zobrazení),
  kategorie, obtížnost, tolerance polohy.
- **profiles** — uživatel: jméno, role (player/admin), XP, agregáty skóre.
- **game_sessions** — odehrané sólo hry (kola + skóre).
- **daily_results** — výsledky denní výzvy (1 za den).
- **multiplayer_rooms / players / rounds / answers** — stav multiplayer her.
- **daily_challenge_assignments** — kalendář: která událost je na který den.

Kategorie událostí: **Války, Historické okamžiky, Objevy míst, Vynálezy, Umění,
Sportovní okamžiky, Záhady a legendy, Katastrofy.**

---

## 6. Bodovací systém

Za kolo lze získat max **1000 bodů** (500 za polohu + 500 za rok), exponenciální pokles:

- **Poloha:** `500 · e^(−max(0, vzdálenost_km − tolerance) / 1500)`
- **Rok:** `500` uvnitř rozsahu `[year_from, year_to]`, jinak `500 · e^(−roky_mimo / 120)`

Hráč navíc získává **XP** (úrovně) napříč všemi režimy.

---

## 7. Admin nástroje

- Správa událostí (CRUD), nahrávání panoramat s automatickou kompresí (WebP, cap 4096×2048)
  a generováním malého náhledu.
- **Hromadný import** událostí z CSV/XLS (vč. překladů a přesného data).
- Kalendář denních výzev (s návrhy podle `event_date`).
- Admin rozhraní je záměrně **jen v češtině**.

---

## 8. Aktuální stav

**Hotovo:** všechny tři herní režimy, i18n CS/EN/DE, admin panel + import,
server-authoritativní skóre v multiplayeru, prefetch + náhledy panoramat,
úklid starých místností, XP/úrovně, analytika, PWA manifest.

**Známé limity / k diskuzi:**
- Skóre v **sólo hře a denní výzvě** je stále počítané na klientovi (multiplayer už ne) —
  teoreticky se dá podvádět.
- Stránky **Zásady ochrany údajů / Podmínky použití** jsou zatím placeholdery.
- Žádné nativní mobilní appky (jen webová PWA).
- Obsah (počet a kvalita panoramat/událostí) je hlavní limit zážitku — škálování obsahu je otevřená otázka.
- Monetizace / udržitelnost zatím neřešena.

---

## 9. O čem se dá bavit (náměty)

- **Produkt:** retence hráčů, onboarding, gamifikace (achievementy, ligy), sdílení výsledků,
  vzdělávací režim pro školy.
- **Obsah:** odkud brát kvalitní 360° panoramata historických míst, jak je škálovat,
  licence, generování popisů.
- **Růst:** distribuce, SEO, virální smyčky (denní výzva, multiplayer pozvánky).
- **Technika:** server-side skóre i pro sólo/daily, anti-cheat, výkon (velikost panoramat),
  offline režim, nativní app.
- **Byznys:** monetizace (předplatné, školní licence), náklady na hosting/úložiště.

---

## 10. Co potřebuju od ChatGPT

> (Sem si doplň konkrétní otázky / oblasti, které chceš probrat.)
