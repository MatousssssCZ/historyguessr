# Handoff: HistoryGuessr — redesign (vizuální jazyk „Pergamen")

## Overview
Kompletní redesign mobilní hry **HistoryGuessr** (hráč se ocitne v 360° panoramatu historické události a hádá **místo na mapě** + **rok**). Cílová skupina 18–35 let; aplikace má působit minimalisticky, prémiově a návykově (reference: Linear, Notion, Arc, Apple, Spotify, GeoGuessr). Tento balíček pokrývá vizuální jazyk a rozvržení klíčových obrazovek pro **mobil i desktop**.

## About the Design Files
Soubor `HistoryGuessr.dc.html` v tomto balíčku je **designová reference vytvořená v HTML** — prototyp ukazující zamýšlený vzhled, rozvržení a chování. **Není to produkční kód k přímému zkopírování.** Úkolem je **znovu vytvořit tyto návrhy ve vašem stávajícím prostředí** (projekt je **React + inline styly**) pomocí zavedených vzorů a komponent. HTML používá pomocný „design canvas" wrapper (telefonní rámečky, sekce `dv-*`, sekce turnů) — ten je jen pro prezentaci variant a **do aplikace nepatří**; implementujte pouze obsah jednotlivých obrazovek.

Návrh je organizovaný do „turnů" (sekce `#t1`…`#t9`), každý turn = jedno kolo iterace s uživatelem. Nejnovější/platné jsou turny s vyšším číslem. Uvnitř jsou varianty s ID jako `4a`, `4c`, `6a`, `6b`, `8a`, `9b` (písmeno `a`/`b`/`c` = mobil/desktop nebo varianta).

## Fidelity
**High-fidelity (hifi).** Finální barvy, typografie, spacing, radiusy a stavy. Rekreujte UI pixel-přesně pomocí stávajících knihoven a vzorů v kódu. Panoramata, mapa (Leaflet/CARTO) a bodovací logika se **nemění** — měňte jen vizuál a rozvržení.

---

## Design Tokens

### Barvy (světlý režim „Pergamen")
| Token | Hex | Použití |
|---|---|---|
| `--paper-50` (pozadí appky) | `#F2ECE2` | hlavní pozadí obrazovek |
| `--paper-card` | `#FBF7F0` | karty, panely, inputy (aktivní) |
| `--paper-inset` | `#EFE7DA` | segment-switch pozadí, vnořené plochy |
| `--paper-tint` | `#F6F1E9` | jemně odlišené karty (desktop mřížky) |
| `--ink` (text primární) | `#26211C` | nadpisy, hlavní text |
| `--ink-soft` (text sekundární) | `#4a4033` | popisky formulářů |
| `--muted` (text terciární) | `#8C8175` | mono labely, meta |
| `--muted-faint` | `#B0A492` | neaktivní ikony, placeholder |
| `--accent` (terakota) | `#BE6240` | primární akce, aktivní stavy, akcent |
| `--accent-strong` | `#D0754F` | horní konec gradientu tlačítek |
| `--accent-warm` | `#D89A54` | konec progres-gradientu |
| `--gold` | `#E7B45A` | odznak 1. místa, drobné highlighty |
| `--green` (správné místo/úspěch) | `#4E7C59` | správný pin na mapě, „odehráno" |
| `--green-soft` | `#8CB39A` | světlejší heatmapa |
| hranice / borders | `rgba(40,30,20,.08–.14)` | jemné okraje karet |
| dělící linky | `rgba(40,30,20,.08–.10)` | oddělovače |

Akcentní gradient (tlačítka, FAB): `linear-gradient(150deg,#D0754F,#BE6240)` nebo `160deg`.
Progres bar fill: `linear-gradient(90deg,#BE6240,#D89A54)`.

> **Dark režim**: existuje přepínač (Můj účet → VZHLED). Každá barva musí fungovat i v tmavém režimu — proto v kódu použijte CSS proměnné, ne natvrdo hex. Tmavá varianta hraní/panoramatu je již tmavá (viz níže). Tmavé hodnoty menu/profilu nejsou v tomto balíčku, odvoďte je z existující dark palety appky.

### Typografie
- **Nadpisy / čísla (display):** `Newsreader` (editorial serif), weight 400, `letter-spacing:-.01em` u velkých. Použití: pozdrav, názvy obrazovek, velká skóre, statistická čísla.
- **UI text / tlačítka / popisky:** `Hanken Grotesk`, weight 400/500/600/700/800.
- **Mono labely (eyebrows, meta, kódy, časovače):** `JetBrains Mono`, weight 500/600, `letter-spacing:.10–.16em`, UPPERCASE.

Škála (mobil → desktop):
- H1 obrazovky: 22–25px (mobil) / 32–34px (desktop), Newsreader 400
- Hero nadpis na panoramatu: 18–19px (mobil) / 28px (desktop), Newsreader 400
- Velké skóre: 30px (mobil) / 44px (desktop), Newsreader 400
- Statistické číslo: 19–24px, Newsreader 400
- Tělo: 11.5–13px (mobil) / 13–15px (desktop), Hanken 500/600
- Eyebrow / mono label: 8.5–10px, JetBrains Mono 500, tracking .12–.16em
- Tlačítko: 13–15px, Hanken 700

### Spacing & tvary
- Padding obrazovky (mobil): `18px` horizontálně; obsah scrolluje, bottom nav fixní.
- Radiusy: karty `16–22px`; velké panely `18–20px`; tlačítka `12–16px`; inputy `11–13px`; segment-switch `14px` (thumb `11px`); malé chip/pill `20–22px`; avatar `50%`; ikonové dlaždice `12–15px`.
- Stíny: karty jemně `0 8px 24px -14px rgba(60,45,30,.3)`; tlačítka/FAB `0 12px 26px -8px rgba(190,98,64,.5)`; telefonní rámeček je jen prezentační.
- Bottom nav (mobil): výška `66px`, `background:rgba(251,247,240,.85)` + `backdrop-filter:blur(16px)`, horní border `1px rgba(40,30,20,.09)`, centrální **FAB Play** 56×56 kruh s akcentním gradientem, posazený `-16px` nad lištu.
- Desktop sidebar: šířka `234px`, pozadí `#F2ECE2`, aktivní položka = karta `#FBF7F0` s jemným stínem a akcentní ikonou.

### Ikony
Sada **Phosphor Icons** (`@phosphor-icons/web`, regular + fill + bold). Použité glyphy: `house, compass, medal, user, play, play-circle, flame, clock, arrow-right, caret-right, caret-down, arrow-left, x, map-pin, calendar-blank, calendar-check, shuffle, users-three, sword, scroll, lightbulb, palette, eye, warning, sliders-horizontal, lightning, plus-circle, link-simple, trophy, book-open, chart-bar, game-controller, target, crosshair-simple, check-circle, check, warning-circle, gear-six, moon, wind, gift`. V appce sjednoťte na jednu sadu (Phosphor doporučeno) místo mixu emoji.

---

## Informační architektura & navigace
**Hlavní navigace = 5 sekcí** (mobil: bottom nav s centrálním FAB; desktop: levý sidebar bez „Nová hra"):
`Domů · Nová hra (jen mobil FAB „Play") · Kampaně · Odznaky · Profil`

- **Domů** = klidný hub (proč se vracet), NE konfigurace hry.
- **Play (FAB)** = akce → otevře **bottom sheet launcher** „Jak chceš hrát?" (Rychlá hra / Klasická / Denní výzva / Multiplayer). Na desktopu nejsou tyto módy v sheetu, ale jako 4 dlaždice přímo na Domů.
- Žádné duplicity: konfigurace hry žije jen na obrazovce „Nastav si hru"; launcher tam jen odkazuje.

---

## Screens / Views

### 1) Domů (`/menu`) — hub
**Účel:** první dojem, motivace, orientace. **Turn `#4a` (mobil), `#4c` (desktop).**
- **Header:** eyebrow mono datum (`ÚT · 1. ČERVENCE`, barva accent), pozdrav Newsreader „Dobré ráno, Admine"; vpravo avatar 42px (kruh, gradient `#e8dfd0→#cdbfa9`) s odznakem série (`flame` + „12", accent pill).
- **Denní výzva (hero karta):** radius 22px, `#FBF7F0`. Nahoře obrázek/panorama 110–196px s tmavým radiálním gradientem přes spodek; vlevo mono label „DENNÍ VÝZVA" s pulsujícím gold dotem, vpravo odpočet pill (`clock` + `14:52` / desktop `zbývá 14:52:07`), dole Newsreader titulek „Kam tě dnes historie zavede?". Patička karty: vlevo `flame` + „Série 12 dní" / „nezmeškej dnešek"; vpravo accent tlačítko „Hrát →".
- **Pokračovat ve hře** (jen když existuje rozehraná hra): karta s accent-tint borderem; thumbnail 52–56px, titulek + pill s **odpočtem `59:32`**, meta „KOLO 3 / 5 · 1 240 b.", kruhové accent play tlačítko. Spodní pruh (accent tint): `warning-circle` + „Vrátit se lze do hodiny. Začnutím nové hry se tato smaže." **Chování:** hru lze obnovit do 60 min; spuštění nové hry ji zahodí.
- **Progres karta:** „Level 4" + „1 559 / 10 000 XP", progres bar (38 %), pod ním 3 statistiky oddělené vertikálními linkami: **15 ODEHRANÁ KOLA · 823 Ø SKÓRE / KOLO · #4 128 POŘADÍ VE SVĚTĚ** (poslední accent barvou). Pořadí je dle XP.
- **Desktop navíc:** sekce `NOVÁ HRA` = 4 dlaždice (Rychlá hra [doporučeno, accent tint], Klasická hra, Denní výzva, Multiplayer), pod nimi Pokračovat + Progres ve 2 sloupcích.
- **NENÍ tu:** multiplayer dlaždice (je za Play), peek na ligu, „série/nejlepší/liga" trojice (nahrazena kola/Ø/pořadí).

### 2) Play launcher (bottom sheet) — mobil
**Účel:** rychlá volba módu. **Turn `#4a`, pravý telefon.**
- Bottom sheet nad ztmaveným/rozmazaným Domů; drag-handle 38×4px; header Newsreader „Jak chceš hrát?" + zavírací kruh (`x`).
- 4 řádky (ikona-dlaždice 44px + titulek + popis + šipka):
  1. **Rychlá hra** — accent-tint karta + accent gradient ikona `lightning` + pill „DOPORUČENO". Popis „1 náhodná událost · hraj hned". (**= 1 náhodná událost, rovnou do panoramatu.**)
  2. **Klasická hra** — `sliders-horizontal`, „Nastav si kola, kategorie a roky" → obrazovka Nastav si hru.
  3. **Denní výzva** — `flame`, „5 kol · 1 pokus denně".
  4. **Multiplayer** — `sword`, „Vyzvi přátele na souboj".

### 3) Nastav si hru (`/play` předsálí solo) — mobil `#2a`, desktop `#2b`
**Účel:** konfigurace klasické hry. Zachovat všechny prvky.
- **Header:** back-kruh + eyebrow „KLASICKÝ MÓD · SÓLO" + Newsreader „Nastav si hru".
- **Počet kol:** segment-switch 3 / **5** / 10 (aktivní = `#FBF7F0` thumb se stínem).
- **Kategorie** (multi-select chips, „nic = bez filtru"): Války, Historické okamžiky, Objevy míst, Vynálezy, Umění, Sportovní okamžiky, Záhady a legendy, Katastrofy. Aktivní chip = accent výplň + bílý text + fill ikona; neaktivní = `#FBF7F0` + border + `muted` ikona.
- **Rozsah let:** dvojitý slider (dva 20–22px thumby, `#FBF7F0` + 2px accent border), pod ním dvě pole „OD PŘ.N.L. −3000" a „DO N.L. 2025" (druhé accent). Track aktivní úsek = accent gradient.
- **Zelený banner:** `rgba(78,124,89,.12)` + border, `check` + „133 událostí ve hře" (živě počítá dle filtrů).
- **Řádek „Vyladit konkrétní události"** (`sliders-horizontal`, počet + caret-down → otevře výběr).
- **CTA:** sticky accent tlačítko „Spustit hru →".
- **Desktop:** sidebar + formulář vlevo (max 560px) + pravý lepivý panel **SHRNUTÍ** (Režim, Počet kol, Kategorie, Rozsah + velké číslo „133 UDÁLOSTÍ VE HŘE" + „Spustit hru" + „1 POKUS · BEZ NÁPOVĚDY").

### 4) Hraní / panorama (`/game`) — mobil `#1b` (pravý telefon)
**Účel:** pohlcující hádání. **Panorama na celé ploše — hfov se nemění.**
- Fullscreen 360° panorama (tmavé). Nahoře status bar (bílý text), pod ním řádek HUD: vlevo kruh `x` (Skončit → potvrzovací modal), uprostřed pill „01 / 05" + „KLASICKÝ MÓD", vpravo pill `clock` „1:20". HUD prvky = `rgba(246,240,230,.82)` + blur + světlý border (v tmavé variantě `rgba(20,20,24,.5)`).
- Segment teček (progress kol) pod HUD.
- Vlevo dole hint pill (`arrows-out-cardinal` „Táhni a rozhlédni se").
- **Vpravo dole 2 ovládací dlaždice (92px):** horní **Rok** (glass, `calendar-blank`, „TIP: —") → posuvník roku −3000…2025; dolní **Mapa** (accent výplň, `map-pin`, „UMÍSTI TIP") → fullscreen mapa s pinem + Odeslat. Plovoucí název události drží nahoře.

### 5) Výsledek kola / denní výzvy (`/daily`, v `/game`) — desktop `#6a`, mobil `#6b`
**Účel:** odměna + poučení. Dvousloupcový desktop / stackovaný mobil.
- **Levý panel:** eyebrow „DNES JSI JIŽ HRÁL", Newsreader název „Bitva u Gettysburgu", vpravo velké accent skóre „873 b." / „z 1 000".
- **Záložky:** segment `🏆 Skóre` (aktivní, accent) / `📖 O události`.
- **Mapa** (Leaflet/CARTO, radius 16px): **zelený pin `#4E7C59` = Správné místo**, **oranžový pin `#BE6240` = Tvůj tip**, mezi nimi **přerušovaná accent spojnice**; popisky v bílých bublinách; zoom +/− vlevo nahoře; atribuce „© OpenStreetMap © CARTO".
- **Dvě karty:** **POLOHA** (číslo Newsreader „377", progres bar, „429 km") a **ROK** („496", bar, „2 let mimo").
- **Řádek:** „SPRÁVNÝ ROK 1863 n. l." / „TVŮJ TIP 1861 n. l.".
- **Tlačítko dál:** „Menu" (mobil = tmavé `#26211C` sticky; desktop = outline).
- **Pravý panel (desktop) / pokračování (mobil):** **ŽEBŘÍČEK DNE** s pill „#1 z 3"; řádky s medailemi (1=gold `#E7B45A`, 2=stříbro `#C6C6C6`, 3=bronz `#C8925E`), tvůj řádek accent-tint + „ty". Pod tím **DISTRIBUCE SKÓRE** histogram (20 sloupců, tvůj sloupec accent + label „ty"), osa 0–1 000, „Top 33 % z 3 hráčů".
- **Denní výzva navíc:** 60s časovač během hraní; XP včetně rychlostního násobiče; odpočet do další výzvy.

### 6) Odznaky + Statistiky (`/stats`) — mobil `#3a` (+ navazující), desktop `#3b`
**Účel:** progres a sběratelství. **Titulový systém:** za každé kolo se **skóre ≥ 950** v kategorii postoupíš na vyšší titul.
- **Header** + shrnutí (2/8 titulů, 4 odznaky; desktop navíc „NEJBLÍŽ: Vojín").
- **Karty kategorií:** získané = accent gradient ikona-dlaždice 46–48px + titul (Newsreader), meta „VÁLKY A BITVY · 2× ≥950", progres bar, „Ještě 1× ≥950 → Vojín". Zamčené = `muted` šedá dlaždice, tlumený text, prázdný bar, „Získej 1× ≥950 → <titul>". Kategorie: Války (Branec→Vojín), Katastrofy (Pozorovatel→Přeživší), Historické okamžiky (Svědek dějin), Objevy míst (Cestovatel), Vynálezy (Učeň), Umění (Návštěvník galerie), Sport (Fanoušek), Záhady (Pátrač). Desktop = mřížka 2 sloupců.
- **Statistika pod odznaky:**
  - Level + XP bar.
  - **PŘEHLED** (4 dlaždice): Odehraných her `3`, Celkové skóre `6 703`, Ø skóre / hra `2 234`, Zásahů do černého `0×` (poslední accent-tint).
  - **PŘESNOST** (4 dlaždice): Ø vzdálenost `805 km`, Ø chyba roku `252 let`, Trefa do 25 km `9 %`, Přesný rok `9 %`.
  - **DENNÍ VÝZVA:** série 2 dní + **kalendář-heatmapa** (mřížka 7 řádků × ~10 týdnů, buňky 11–13px, radius 3px; zelená `#4E7C59`/`#8CB39A` = odehráno, `rgba(190,98,64,.20)` = vynecháno) + legenda.
  - **VÝVOJ VÝKONU:** sloupcový graf 8 sloupců (poslední accent), „skóre / hra", popisky „první hry → poslední hry".

### 7) Přátelé (`/friends`) — mobil `#5a`
- Header back + Newsreader „Přátelé".
- Karta **PŘIDAT PŘÍTELE**: input „Přezdívka hráče" + accent tlačítko „Přidat".
- **PŘÁTELÉ (2)**: řádky s avatar-monogramem (barevný kruh), jméno + „LEVEL 4", outline tlačítko „Odebrat". Data: „Chris P. Bacon / Level 4", „jinic / Level 6".
- Příchozí žádosti (přijmout/odmítnout) — v appce zachovat, není v mocku vykresleno.

### 8) Multiplayer — vstup (`/multiplayer`) — mobil `#5b`
- Back-kruh, eyebrow „VÍCE HRÁČŮ", Newsreader „Zahraj si s přáteli".
- Dvě karty: **Založit hru** (accent-tint, `plus-circle`, „Vytvoř místnost a pozvi přátele"), **Připojit se** (`link-simple`, „Zadej pětimístný kód").
- **Pole pro 5-místný kód** (5 boxů, poslední s accent borderem), label „KÓD MÍSTNOSTI · 5 ZNAKŮ".
- **Lobby + hra** (v appce zachovat, není v mocku): seznam hráčů, nastavení (kola, čas, kategorie, rozsah let, režim Klasický/Battle Royale), mezikolní odpočet, žebříček kola.

### 9) Můj účet (`/account`) — mobil `#5c`
- Header back + Newsreader „Můj účet".
- **PROFIL** karta: E-mail (disabled input „bahnik.matous2@gmail.com"), Uživatelské jméno (aktivní input „Admin"), **tmavé** tlačítko „Uložit změny" (`#26211C`).
- **VZHLED** karta: „Světlý / tmavý režim" + toggle (thumb s `moon` ikonou).
- **RELACE** karta: „Přihlášen jako **bahnik.matous2@gmail.com**", outline accent tlačítko „Odhlásit se".

### 10) Potvrzovací e-mail po registraci — `#7a` (e-mail, 600px) + `#7b` (návazná obrazovka)
**Účel:** dokončit registraci, přesměrovat na přihlášení. E-mail-safe šablona, šířka pevná **600px**.
- **Header pruh:** tmavé pozadí `#26211C`, logo (ikona kompasu v accent gradientu) + „HistoryGuessr" (Newsreader, světlý text).
- **Hero pruh:** 150px, panorama placeholder gradient s pinem uprostřed a mono labelem „VÍTEJ V HISTORII".
- **Tělo (text-align center):** eyebrow „POSLEDNÍ KROK" (accent, mono), Newsreader „Potvrď svou registraci", vysvětlující věta, hlavní CTA tlačítko **„Potvrdit registraci →"** (accent, radius 14px). Pod tím záložní odkaz ke zkopírování (`https://historyguessr.app/verify?token=…`) v mono fontu na jemném pozadí. Info řádky: „Odkaz je platný 24 hodin." a „Pokud jsi účet nezakládal, tento e-mail můžeš klidně ignorovat."
- **Patička:** světlé pozadí, logo (Newsreader), slogan, `© rok HistoryGuessr · Nápověda · Odhlásit odběr`.
- **Chování:** kliknutí na CTA otevře webový odkaz `/verify?token=…`, backend potvrdí účet a **přesměruje na přihlašovací stránku** (`#7b`/`8a`) se zeleným potvrzovacím bannerem „E-mail potvrzen — vítej!" nad formulářem.

### 11) Přihlášení / Registrace (`/login`, `/register`) — desktop split `#8a`/`#8b`, mobil `#8c`
**Účel:** lákavý vstup i pro nepřihlášené návštěvníky — prodat produkt, ne jen formulář.
- **Layout (desktop):** split 52/48. **Levý panel = marketing**, plná fotka na pozadí (skutečné 360° panorama, ne placeholder) s tmavým gradientovým overlayem zleva doprava pro čitelnost textu (`linear-gradient(100deg, rgba(38,33,28,.82) 0%, rgba(38,33,28,.62) 46%, rgba(38,33,28,.3) 100%)`). Nahoře logo, dole eyebrow (mono, gold) + Newsreader headline **„Cesta do historie, kterou jsi ještě nezažil."** (celá druhá věta v accent-světlé barvě `#F3966B`) + krátký podtext + citát v uvozovkách s accent linkou vlevo.
  - **8a (přihlášení):** podtext „Denní výzvy · kampaně · odznaky a achievementy" (u varianty registrace) nebo obdobný na míru přihlášení.
  - **8b (registrace):** stejná kompozice, bez dodatečných dlaždic pod headline — jen headline, podtext a citát (dlaždice „Denní výzva"/„8 titulů" byly odstraněny jako redundantní).
- **Pravý panel = formulář** na `#F6F1E9`: přepínač tab Přihlásit se / Registrovat (segment switch), pak formulář:
  - **Přihlášení:** E-mail, Heslo (s ikonou oka), „Zapomněl jsi heslo?", accent CTA „Přihlásit se →".
  - **Registrace:** Uživatelské jméno, E-mail, Heslo, Heslo znovu, checkbox souhlasu s podmínkami, accent CTA „Vytvořit účet →".
  - **Obě:** pod hlavním CTA oddělovač „NEBO" + outline tlačítko **„Vyzkoušet bez registrace"** + poznámka „1 kolo zdarma · registrace není potřeba" → vede na Zkušební kolo (`#9a`).
- **Mobil (`#8c`):** hero pruh nahoře (150px) se stejnou fotkou na pozadí + tmavý overlay + logo + zkrácený headline; pod ním `#FBF7F0` karta s tab přepínačem a formulářem; na konci stejné CTA „Vyzkoušet bez registrace".
- **Obrázek:** panel používá skutečnou fotku panoramatu historické události jako pozadí (v prototypu implementováno jako uživatelsky nahraditelný slot) — v produkci nahradit reálným reprezentativním snímkem, ideálně s vysokým kontrastem pro čitelnost textu přes overlay.

### 12) Zkušební kolo bez registrace (`/try`) — mobil `#9a` (intro) + `#9b` (výsledek)
**Účel:** snížit vstupní bariéru — nechat návštěvníka zažít hru dřív, než se rozhodne založit účet.
- **9a Intro:** eyebrow „BEZ REGISTRACE", Newsreader „Vyzkoušej si cestu do historie", vysvětlující text (bez výpisu konkrétních událostí — překvapení je součástí zážitku), CTA „Vstoupit do historie →" → spustí **1 náhodně vybranou událost** ze sady (v mocku ukázáno na příkladu „Černobylská havárie"; produkčně libovolná z fondu demo-eventů) a přesune do standardní obrazovky Hraní (`#1b`). Tichý odkaz „Máš už účet? Přihlas se".
- **9b Výsledek zkušebního kola:** stejná struktura jako produkční Výsledek (`#6b`) — ikonka domů (`house`) vpravo nahoře vedle eyebrow labelu „ZKUŠEBNÍ KOLO" (vede zpět na Domů `#4a`), název události + skóre, tabs Skóre/O události, mapa s piny + spojnicí a popisky, karty POLOHA/ROK s progress bary, řádek SPRÁVNÝ ROK/TVŮJ TIP.
  - **Žebříček dne je zamčený/rozmazaný** (`filter:blur(3px)` + overlay se zámkem `lock-simple` a textem „Žebříček odemkneš po registraci") — motivační gating, ne error state.
  - **Primární CTA:** accent tlačítko **„Zaregistrovat a hrát další →"** → vede na registraci (`#8b`).
  - Pod ním tichý sekundární odkaz „Zkusit jinou náhodnou událost" (další demo kolo bez limitu, nebo s měkkým limitem dle vašeho rozhodnutí — v mocku bez omezení znázorněno).
  - Bez rámečku/vysvětlujícího textu nad CTA — samotné tlačítko a odkaz stačí (odstraněno na žádost jako redundantní).

---

## Interactions & Behavior
- **Navigace:** bottom nav (mobil) / sidebar (desktop) přepíná 5 sekcí; centrální FAB otevře Play launcher (spring bottom-sheet, ztmavení pozadí + blur).
- **Rychlá hra:** 1 tap → 1 náhodná událost → rovnou fullscreen panorama (přeskočí konfiguraci).
- **Pokračovat:** viditelné jen s rozehranou hrou; odpočet 60:00→0 (mm:ss), po vypršení karta zmizí; nová hra rozehranou zahodí (bez potvrzení, jen varovný pruh).
- **Hraní:** táhnutím rotace panoramatu; Mapa/Rok otevírají fullscreen/slider; Odeslat → reveal výsledku (mapa dokreslí piny + spojnici, čísla se dopočítají — jemná „oslava", nikdy pocit prohry). „Skončit" (`x`) → potvrzovací modal.
- **Nastav si hru:** změny kategorií/rozsahu živě přepočítají počítadlo „X událostí ve hře".
- **Odznaky:** karty rozklikávací (žebříček úrovní titulu).
- **Denní výzva:** 60s časovač; rychlostní násobič do XP; po odehrání zamčeno do půlnoci (odpočet).
- **Responsivita:** mobile-first, `100dvh`, safe-area. Desktop = sidebar + širší mřížky; sheet-módy se mění na dlaždice na Domů.
- **Přechody:** jemné (150–250ms ease-out); progres bary animují fill; reveal skóre count-up.

## State Management
- `theme: 'light' | 'dark'` (persist), `locale` (přepínač jazyka), `user {name, email, level, xp, streak, worldRank}`.
- `activeGame {mode, round, totalRounds, score, expiresAt}` pro Pokračovat (null když žádná).
- `setup {rounds:3|5|10, categories:string[], yearRange:[from,to]}` → derived `eventCount`.
- `dailyChallenge {playedToday:bool, score, leaderboard[], histogram[], resetAt}`.
- `badges[] {category, currentTitle, nextTitle, progressCount, threshold:950, unlocked}`.
- `stats {games, totalScore, avgScore, bullseyes, avgKm, avgYearErr, hit25pct, exactYearPct, calendar[], trend[]}`.
- `friends[] {name, level}`, `friendRequests[]`.
- `multiplayer {roomCode, players[], settings}`.
- `auth {status: 'guest'|'pending_verification'|'verified', verifyTokenExpiresAt}` — guest = zkušební kolo bez účtu (žádná data se neperzistují mezi relacemi, žebříček je gated).
- `demoRound {eventId, score, distanceKm, yearDiff}` — dočasný, jen pro zkušební kolo; nezapočítává se do statistik po registraci.

## Assets
- **Ikony:** Phosphor Icons (web font) — regular/fill/bold. V appce použijte již integrovanou ikonovou sadu, sjednoťte (nahradit stávající emoji 📅🎮🏆👥🗺️ konzistentní sadou).
- **Fonty:** Newsreader, Hanken Grotesk, JetBrains Mono (Google Fonts). Mapují se na existující stack (Fraunces→Newsreader-like serif, Inter→Hanken-like grotesk, JetBrains Mono zůstává). Pokud chcete zachovat Fraunces/Inter dle stávajícího briefu, použijte je — návrh je na serif+grotesk párování agnostický, drží se role (display serif / UI grotesk / mono meta).
- **Panorama & mapa:** reálné 360° obrázky a Leaflet/CARTO dlaždice z vaší appky — v mocku jen placeholdery (gradient + clip-path pevnina). Piny a spojnici vykreslete přes mapovou vrstvu.
- **Obrázky kampaní/výzvy:** vlastní fotografie událostí; v mocku placeholder gradienty.
- **Auth hero fotka (`#8a`/`#8b`/`#8c`):** skutečná fotka/panorama historické události na pozadí levého marketingového panelu (desktop) a hero pruhu (mobil), s tmavým gradientovým overlayem pro čitelnost textu. V prototypu je to uživatelsky nahraditelný obrázkový slot — v kódu jde o běžný `background-image`/`<img>` s overlay vrstvou.

## Files
- `HistoryGuessr.dc.html` — kompletní hi-fi prototyp všech obrazovek (turny #t1–#t9). Otevřete v prohlížeči; relevantní varianty: Domů `#4a`/`#4c`, Play launcher `#4a`, Nastav si hru `#2a`/`#2b`, Hraní `#1b`, Výsledek `#6a`/`#6b`, Odznaky+Statistiky `#3a`/`#3b`, Přátelé `#5a`, Multiplayer `#5b`, Můj účet `#5c`, Potvrzovací e-mail `#7a`/`#7b`, Přihlášení/Registrace `#8a`/`#8b`/`#8c`, Zkušební kolo `#9a`/`#9b`. (Skryté varianty `#1a` KINO a `#1c` ATLAS jsou zavržené alternativní palety — ignorujte.)

## Poznámky k implementaci
- Bundlované HTML jsou **reference** — rekreujte je v React + inline stylech vaší appky, po jedné obrazovce.
- Držte **tvrdá pravidla**: paleta funguje v light i dark (CSS proměnné), mobile-first + safe-area, panorama hfov pevné (herní plocha nechá panorama fullscreen), bodovací a herní logika beze změny.
- Prezentační wrapper (telefonní rámečky `width:314px…`, sekce `dv-turn`/`dv-opt`, `<sc-for>`/`<sc-if>`) do produkce nepatří — implementujte jen obsah obrazovek a nahraďte smyčky reálnými daty.
