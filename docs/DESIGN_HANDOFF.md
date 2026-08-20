# HistoryGuesser — Design Handoff

> Balíček pro **Claude Design** / redesign. Cíl: modernější, výraznější a soudržnější
> vizuál napříč všemi obrazovkami při zachování „historického / sépiového" charakteru značky.
> Aplikace je **mobile-first** (většina hráčů na telefonu), s plnohodnotným desktop layoutem.

---

## 1. O produktu

Vzdělávací geolokační hra (žánr GeoGuessr). Hráč vidí **360° panorama historického místa**
a hádá **kde na světě** to je (mapa) a **v jakém roce** se událost odehrála (posuvník let).
Skóre = poloha (0–500) + rok (0–500), max 1000 za kolo.

- **Stack:** React 18 + Vite + TS. Styling: **CSS proměnné + inline styly** (žádný Tailwind/UI kit).
- **Motivy:** světlý i tmavý (`[data-theme]`), plus „feature" plochy které se přepínají.
- **Jazyky:** CS / EN / DE.
- **Platformy:** telefon (primár), desktop, PWA.

**Charakter značky:** starožitný / „archivní" nádech (sépie, serifový Fraunces na nadpisy),
ale ovládání má být moderní a svěží. Redesign má povýšit **hierarchii, prostor, mikro-interakce
a konzistenci komponent**, ne přebarvit vše.

---

## 2. Design tokeny (aktuální — výchozí bod, lze modernizovat)

### Barvy — světlý režim
| Token | Hex | Užití |
|---|---|---|
| `--paper-50` / `--surface` | `#faf7f0` | karty, povrchy |
| `--paper-100` / `--bg` | `#f5f1e8` | pozadí stránky |
| `--paper-200/300/400/500` | `#ebe4d4 → #8a7a5d` | oddělovače, tlumené plochy |
| `--sepia-900` / `--ink` | `#2a1f17` | hlavní text |
| `--sepia-700` / `--ink-2` | `#5a4632` | sekundární text |
| `--sepia-500` / `--ink-3` | `#9b8167` | tlumený text |
| `--accent` | `#d97757` | **terakota — primární akce** |
| `--accent-deep` | `#b85a3e` | hover / gradient konec |
| `--success` | `#5c9468` | úspěch / „správně" |
| `--danger` | `#c0392b` | chyby, mazání |
| `--line` | `rgba(42,31,23,.10)` | jemné okraje |

- **Akcentní gradient:** `linear-gradient(150deg,#d97757,#b85a3e)` (primární tlačítka, ikonové čipy).
- Tmavý režim překlápí `--paper-*` do tmavé a `--ink-*` do světlé (viz `globals.css`).
- `--on-dark: #f5f1e8` = text nad trvale tmavými plochami (panorama).
- „Feature" plochy (`--feature-bg/fg/...`) = hlavičky, hero, předsálí — přepínají se s tématem.

### Nově zavedený barevný akcent per herní režim (Menu, desktop — „Návrh 2")
- Rychlá hra = terakota (accent) · Klasická = modrá `#37658A` · Multiplayer = zelená `#4E7A50`.
  → Redesign může tento **per-režim barevný klíč** rozšířit napříč appkou (konzistence).

### Typografie
- `--font-serif: Fraunces` — nadpisy, čísla skóre, „hero" texty.
- `--font-sans: Inter` — UI text, tlačítka, popisky.
- `--font-mono: JetBrains Mono` — štítky (`DOPORUČENO`), malé caps labely, kódy místností.

### Rádiusy / stíny / pohyb
- Radius: `sm 6 · 10 · lg 16 · xl 24`.
- Shadow: `sm / (default) / lg / xl` (viz tokeny).
- Ease: `--ease-spring cubic-bezier(.34,1.56,.64,1)`, `--ease-out cubic-bezier(.16,1,.3,1)`.
- **Safe-area:** vždy `env(safe-area-inset-*)`, výška `100dvh` (ne `100vh`).
- Mobilní spodní lišta: 66px, obsah odsazen `--nav-space`.

### Pevná pravidla (NEMĚNIT bez explicitního zadání)
1. **Panorama hfov = 120** (pevně, ne nastavitelné).
2. **Bodování** (`scoring.ts`) je záměrné — neměnit.
3. Vždy **CSS proměnné**, ne hardcoded barvy.
4. Vždy **safe-area** + `100dvh`.

---

## 3. Mapa obrazovek (co redesignovat)

Legenda: 🎮 hráč · 🛠 admin · **P** = priorita pro redesign (P1 nejvyšší — nejvíc viděné).

### 🎮 Hráčské obrazovky

| # | Obrazovka | Soubor | Route | P | Účel & klíčové prvky |
|---|---|---|---|---|---|
| 1 | **Auth** | `Auth.tsx` | `/auth` | P1 | Přihlášení / registrace / Google. První dojem. Hero + formulář. |
| 2 | **Menu (Home)** | `Menu.tsx` | `/menu` | P1 | Rozcestník. Hero hlavička, dlaždice režimů (nově barevný pruh), denní výzva, rychlé statistiky, spodní nav (mobil). |
| 3 | **PreGameLobby** | `PreGameLobby.tsx` | `/play` | P1 | Předsálí solo: počet kol, kategorie, rozsah let (dvojitý slider `YearRange`), start. |
| 4 | **Game (solo)** | `Game.tsx` | `/game` | **P1** | Jádro. Panorama (Pannellum) + dlaždice mapy (88px kruh → fullscreen) + picker roku + výsledková karta (fullscreen `fixed`). Mobil i desktop layout. |
| 5 | **Daily Challenge** | `Daily.tsx` | `/daily` | P1 | 1 kolo, timer 60 s, 1 pokus/den. Výsledek: leaderboard + histogram skóre. |
| 6 | **Multiplayer Lobby** | `MultiplayerLobby.tsx` | `/multiplayer/lobby` | P2 | Vytvořit/připojit místnost (5-místný kód), nastavení, seznam hráčů (realtime). |
| 7 | **Multiplayer Game** | `MultiplayerGame.tsx` | `/multiplayer/game/:id` | P2 | Herní smyčka MP: kolo, moje výsledky → žebříček kola (timer 8 s) → další. |
| 8 | **Leaderboard** | `Leaderboard.tsx` | — | P2 | Žebříček dle **XP**, přepínač Svět / Přátelé (vycentrovaný), řádky s pořadím. |
| 9 | **Stats** | `Stats.tsx` | `/stats` | P2 | Statistiky hráče: kola, Ø skóre/kolo, achievementy, kategorie. |
| 10 | **PlayerProfile** | `PlayerProfile.tsx` | — | P2 | Veřejný profil: XP, body za kola, streak, world rank, zásahy kategorií. |
| 11 | **Account** | `Account.tsx` | `/account` | P3 | Profil / nastavení účtu (bez statistik), jazyk, motiv, odhlášení. |
| 12 | **Friends** | `Friends.tsx` | — | P3 | Přátelé — správa, přidání. |
| 13 | **Campaigns** | `Campaigns.tsx` | — | P2 | Kampaně / tematické sady kol. |
| 14 | **Challenge** | `Challenge.tsx` | — | P3 | Výzva (sdílený challenge). |
| 15 | **Premium** | `Premium.tsx` | — | P3 | Placený plán / benefity. |
| 16 | **Roadmap** | `Roadmap.tsx` | — | P3 | Veřejná roadmapa. |
| 17 | **TryGame / GuestSetup** | `TryGame.tsx`, `GuestSetup.tsx` | — | P2 | Onboarding pro hosty (zkusit bez účtu). |
| 18 | **ResetPassword** | `ResetPassword.tsx` | `/reset-password` | P3 | Nastavení nového hesla. |
| 19 | **Privacy / Terms** | `Privacy.tsx`, `Terms.tsx` | `/privacy`, `/terms` | P3 | Právní texty (`legalContent.ts`). |

### 🛠 Admin obrazovky (nižší priorita — interní)

| Obrazovka | Soubor | Účel |
|---|---|---|
| Admin Hub | `AdminHub.tsx` | Rozcestník administrace |
| Admin (události) | `Admin.tsx` | CRUD událostí, komprese panoramat, preview, EN/DE, batch náhledy |
| Import | `AdminImport.tsx` | Hromadný import CSV/XLS |
| Bulk AI | `AdminBulkAI.tsx` | Hromadné AI generování |
| Daily Challenge | `AdminDailyChallenge.tsx` | Kalendář denních výzev |
| Campaigns | `AdminCampaigns.tsx` | Správa kampaní |
| Continents | `AdminContinents.tsx` | Kontinenty / geo |
| Feedback | `AdminFeedback.tsx` | Zpětná vazba hráčů |
| Reports | `AdminReports.tsx` | KPI + graf (kola, aktivní hráči, noví uživatelé) |
| Roadmap | `AdminRoadmap.tsx` | Editace roadmapy |
| Panorama Repair | `AdminPanoramaRepair.tsx` | Oprava vadných panoramat |

---

## 4. Sdílené komponenty (redesignovat jednou → projeví se všude)

| Komponenta | Soubor | Poznámka |
|---|---|---|
| **GuessMap / ResultMap** | `GameMap.tsx` | Leaflet mapa (CartoDB Voyager). `compact` prop = kruhový mini-stav. |
| **YearRange** | `YearRange.tsx` | Dvojitý slider rozsahu let (solo + MP). |
| **Icon** | `Icon.tsx` | Line SVG ikony (bolt, sliders, swords, …), dědí barvu/velikost. |
| **BackButton** | `BackButton.tsx` | Jednotný výrazný návratový prvek (accent). |
| **LanguageSwitcher** | `LanguageSwitcher.tsx` | CS/EN/DE. |
| **ThemeToggle** | `ThemeToggle.tsx` | Světlý/tmavý. |
| **ErrorBoundary** | `ErrorBoundary.tsx` | Fallback proti bílé obrazovce. |
| Spodní navigace (mobil) | v `Menu.tsx` | 66px lišta, ikony režimů. |

**Rok-picker** (v Game/Daily): slider −3000 … 2025, **modrá = př. n. l.**, **oranžová = n. l.**,
tlačítka ±10 / ±1, přímý číselný input. Klíčový a specifický prvek — v redesignu zachovat logiku,
zmodernizovat vzhled.

---

## 5. Cíle redesignu (brief pro Claude Design)

**Chci modernější design.** Konkrétní směr:

1. **Silnější vizuální hierarchie** — jasně čitelné primární akce (Hrát), méně vizuálního šumu,
   více bílého prostoru. Aktuálně je hodně inline-styled dlaždic s podobnou váhou.
2. **Soudržný komponentový systém** — jednotné karty, tlačítka, štítky, čipy, prázdné stavy.
   Definovat 2–3 úrovně tlačítek (primár/sekundár/ghost), jednotný card styl, jednotné section-labely.
3. **Per-režim barevný klíč** (terakota / modrá / zelená) použít konzistentně napříč (Menu, lobby, výsledky).
4. **Mikro-interakce** — hover/press stavy, spring animace (tokeny už existují), plynulé přechody
   mezi herními fázemi.
5. **Herní obrazovka (Game.tsx) = vlajková loď** — maximálně čistý overlay nad panoramatem:
   mapa, rok, potvrzení tipu, výsledková karta. Musí být skvělá na mobilu (palce, safe-area) i desktopu.
6. **Výsledkové obrazovky** (solo / daily / MP) sjednotit do jednoho vizuálního jazyka
   (skóre, mapa s čárou tip→cíl, rozpad bodů poloha/rok, „další").
7. **Zachovat značku** — sépie + Fraunces nadpisy + terakota akcent. Modernizovat, ne předělat identitu.
8. **Light i dark** — každý návrh musí fungovat v obou (feature plochy se přepínají).

### Doporučené pořadí práce
**P1:** Menu → Game (+ výsledková karta) → PreGameLobby → Daily → Auth.
Pak P2 (Multiplayer, Leaderboard, Stats, Profile, Campaigns), nakonec P3 a admin.

### Rozměry pro artboardy
- **Mobil:** 390 × 844 (iPhone-ish), počítat se safe-area a spodní lištou 66px.
- **Desktop:** 1280 × 800 (obsah často v centrované koloně ~ max 720–960px).

---

## 6. Kde co najít (pro implementaci návrhů)

- Tokeny: `src/index.css` / `globals.css` (`:root`, `[data-theme="dark"]`).
- Ikony: `src/components/Icon.tsx` (rozšířit o nové názvy dle potřeby).
- Texty/i18n: `src/i18n/resources.ts` (namespaces `menu`, `lb`, `pp`, `stats`, …) — CS/EN/DE.
- Herní logika (neměnit kvůli designu): `useGame.ts`, `scoring.ts`, `multiplayer.ts`.

> Pozn.: veškerý styling je inline + CSS proměnné. Redesign implementovaný v kódu by měl
> primárně upravovat inline styly komponent a případně přidat sdílené style-helpery,
> ne zavádět nový CSS framework.
