# Handoff — redesign admin reportingu (HistoryGuesser)

Balíček pro **Claude Design**. Cíl: navrhnout hezčí, modernější a přehlednější
analytickou obrazovku „📊 Reporting" v administraci. Návrh je jen vizuální
(mockup/artboard); data i logika už v appce existují — designér nepotřebuje nic
vymýšlet ohledně zdrojů, jen to krásně poskládat.

---

## 1. Kontext

- **Produkt:** HistoryGuesser — „Street View do minulosti", vzdělávací hra (poznej místo + rok na 360° panoramatu).
- **Obrazovka:** `/admin` → Reporting. **Interní analytický dashboard** jen pro majitele/admina (ne pro hráče).
- **Audience:** 1 člověk (majitel), technicky zdatný, chce rychle vidět „jak appce jde" a kde je problém.
- **Zařízení:** primárně desktop (široká plocha), ale musí být použitelné i na mobilu.
- **Jazyk:** čeština (admin je jen CZ, žádné EN/DE varianty netřeba).

**Co je špatně teď:** je to funkční, ale „placaté" — samé stejně velké KPI kachličky
pod sebou, jedna barva (oranžová), slabá vizuální hierarchie, žádný „hero" pohled na
nejdůležitější čísla, grafy jsou minimalistické. Chci **moderní analytický dashboard**
s jasnou hierarchií, hezkými grafy a klidem v layoutu.

---

## 2. Design systém (musí se dodržet)

Appka má vlastní vizuální styl — sepia/papírový, „muzejní", elegantní. Drž se ho.

**Fonty**
- Nadpisy / velká čísla: **Fraunces** (serif, opsz, wght 300–700) — používá se na KPI čísla.
- Text/UI: **Inter** (400/500/600).
- Čísla v tabulkách, drobné popisky, „eyebrow": **JetBrains Mono**.

**Barvy — světlý režim (výchozí)**
```
--paper-50  #faf7f0   (surface / karty)
--paper-100 #f5f1e8
--paper-200 #ebe4d4   (pozadí stránky)
--paper-300 #ddd2bb
--sepia-900 #2a1f17   (--ink, hlavní text)
--sepia-500 #9b8167   (--ink-3, popisky)
--accent    #d97757   (oranžová — primární akcent, CTA, hlavní datová série)
--accent-deep #b85a3e
--success   #5c9468   (zelená — pozitivní)
--danger    #c0392b   (červená — varování/chybějící data)
--line      rgba(42,31,23,0.10)  (jemné okraje)
```

**Barvy — tmavý režim** (dashboard musí fungovat v obou; role tokenů zůstávají):
```
--surface   #211a12   --paper-200 #2a2017   --ink #f2ece0   --ink-3 #9a8b76
--line rgba(245,241,232,0.10)   --success #8fcf9a   --danger #e8695b   --accent zůstává oranžová
```

**Sekundární datové barvy** (už se používají v grafech, klidně rozšiř do ucelené palety):
`#5b7fa6` (modrá), `#1d6b3a` (zelená). Pro víc sérií navrhni harmonickou paletu v sepia/přírodním duchu (ne neonové).

**Existující UI patterny, na které navazuj**
- „eyebrow" = malý MONO nadpis sekce, uppercase, letter-spacing.
- KPI karta: `surface` pozadí, 14px radius, 1px `--line` okraj, velké Fraunces číslo + malý popisek pod ním; varianty: `hl` (číslo v accentu), `warn` (červený okraj + červené číslo).
- Radiusy 10–18px, jemné stíny, hodně bílého prostoru.

---

## 3. Data k zobrazení (přesně to, co je k dispozici)

Nahoře je **přepínač období: 7 / 30 / 90 dní** (ovlivňuje časové řady a denní výzvu).

### A) Uživatelé & aktivita (KPI)
`Registrovaných`, `S přezdívkou`, `Aktivní dnes` (highlight), `Aktivní 7 dní`, `Aktivní 30 dní`, `Odehraných kol celkem`.

### B) Vývoj za N dní — časová řada (graf)
Řádky `{ day, new_users, active_users, rounds }`. Teď: jednoduchý sloupcový/čárový graf 3 sérií s tooltipem.
Série: **Aktivní hráči** (accent), **Kola** (modrá `#5b7fa6`), **Noví uživatelé** (zelená `#1d6b3a`).

### C) Hry podle kategorie (horizontal bars)
`{ category, plays }` — vodorovné pruhy seřazené dle počtu her.

### D) Kampaně — hraní (KPI + tabulka)
KPI: `Odehraných pokusů`, `Dokončení` (hl), `Hráčů`, `Hraných kampaní`, `Na 3 hvězdy`.
Tabulka `{ campaign, category, attempts, completions, players, avgStars, avgScore }` — sloupec „Dokončení" má mini-bar v buňce.

### E) Nejhranější / Nejméně hrané události (2 seznamy vedle sebe)
`{ title, category, play_count }` — top 8 a bottom 8.

### F) Obsah & kvalita dat (KPI, s varováními)
`Publikovaných událostí`, `Skrytých událostí`, `Bez panoramatu` (warn), `Bez EN/DE překladu` (warn), `Přiřazených dní výzvy` (sub „/ 366").

### G) Denní výzva — účast za N dní (graf)
`{ day, players, avg_score }` — sloupce účasti + průměrné skóre.

### H) Multiplayer (KPI)
`Místností celkem`, `Dohraných`, `Ø hráčů/místnost`, `Klasický mód`, `Battle Royale`.

---

## 4. Co od návrhu chci (zadání pro Claude Design)

Navrhni **jeden dlouhý dashboard** (desktop artboard ~1280 šířka + varianta mobil ~390), moderní analytika:

1. **Hero pruh** nahoře: 3–4 nejdůležitější čísla velká a výrazná (návrh: `Aktivní dnes`, `Aktivní 30 dní`, `Odehraných kol`, `Dokončení kampaní`) — vizuálně dominantní, možná s malým trendem (▲ %, jiskřička/sparkline).
2. **Jasná hierarchie** — ne všechno stejně velké. Rozliš „přehledová čísla" vs. „detailní tabulky/grafy". Použij mřížku s různě velkými dlaždicemi (bento-style klidně).
3. **Hezčí grafy** — časová řada jako elegantní area/line s jemným gradientem, kategorie jako čisté bar chart, denní výzva jako sloupce. Drž se sepia palety, žádné neony.
4. **Segmentace do „karet-panelů"** s nadpisem (eyebrow) — Aktivita / Trendy / Kampaně / Události / Kvalita obsahu / Denní výzva / Multiplayer.
5. **Stav „warn"** (chybějící panorama / překlady) ať vizuálně vyskočí (jemně červená), aby admin hned viděl, co doplnit.
6. **Přepínač období** (7/30/90) elegantně v hlavičce.
7. **Light i dark** varianta (aspoň naznač, že funguje v obou).

**Technická omezení pro pozdější implementaci** (ať návrh je realistický):
- Grafy budou **inline SVG** (bez těžkých knihoven) — takže drž je jednoduché, čitelné, bez 3D a složitých efektů.
- Používej **CSS proměnné/tokeny** výše (ne natvrdo hex, kde to jde) — kvůli light/dark.
- Musí být **responzivní** (mřížka se skládá do 1 sloupce na mobilu, tabulky scrollují vodorovně).
- Fonty: Fraunces / Inter / JetBrains Mono (viz výše).

**Čeho se vyvarovat:** generický „SaaS" tmavě-modrý dashboard, neonové gradienty, přeplácané widgety, ikonky bez smyslu. Cíl je *klidná, muzejně elegantní analytika* v duchu HistoryGuesseru.

---

## 5. Reference v kódu (pro pozdější zapojení)

- Obrazovka: `src/pages/AdminReports.tsx` (KPI/Section/Grid/SeriesChart/DailyChart/CampaignTable komponenty).
- Data-fetch a typy: `src/lib/supabase.ts` — `getReportOverview`, `getReportMultiplayer`, `getReportDailySeries`, `getReportCategories`, `getReportEventsRanked`, `getReportDailyChallenge`, `getReportCampaigns`, `getReportCampaignsOverview`; typy `DailySeriesRow`, `CategoryRow`, `RankedEvent`, `DailyChallengeRow`, `CampaignReportRow`.
- Design tokeny: `src/styles/globals.css`.

> Po schválení návrhu ho převedu do Reactu s existujícími tokeny a napojím na data výše — zdroje ani logiku není třeba měnit.
