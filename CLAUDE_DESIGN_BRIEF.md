# HistoryGuessr — design brief (pro návrh nového vizuálu)

> Vlož tenhle dokument jako zadání. Ideálně **přilož i screenshoty** klíčových
> obrazovek (menu, hra, výsledek, denní výzva) — vizuální reference je nejsilnější
> signál, text ji jen doplňuje.

---

## 1. Co to je

**HistoryGuessr** — vzdělávací hra à la GeoGuessr, ale s historií. Hráč vidí
**360° panorama** historického místa a hádá:
1. **kde na světě** se odehrálo (pin do mapy),
2. **v jakém roce** se stalo (posuvník −3000 … 2025).

Za přesnost dostává body (max 1000/kolo: 500 poloha + 500 rok). **Mobile-first**,
hraje se i na desktopu. Jazyky: **CS / EN / DE**. Světlý i tmavý režim.

**Vibe / nálada:** „historický deník / starý atlas" — papírová sépiová paleta,
serifové nadpisy, klidné, knižní, prémiové, vzdělávací. **Ne** gamingově neonové.

---

## 2. Design systém (přesné hodnoty)

**Barvy — světlý režim (výchozí):**
- Papír (pozadí): `#faf7f0` (hlavní) · `#f5f1e8` · `#ebe4d4`
- Inkoust (text): `#2a1f17` (hlavní) · `#5a4632` (sekundární) · `#9b8167` (tlumený)
- **Akcent (terakota):** `#d97757` · tmavší `#b85a3e` · světlejší `#e89a82`
- Zlatá (dekor nadpisů): `#f5ce8b`
- Úspěch / zelená (správné místo, kladné stavy): `#5c9468` / `#3f7a4d`
- Chyba / červená: `#c0392b`
- Linky / oddělovače: `rgba(42,31,23,0.10)`

**„Feature" plochy (tmavé sekce — hlavička menu, hero, herní pozadí):**
pozadí `#2a1f17`, text `#f5f1e8`. Herní panorama plocha je téměř černá `#0d0906`.

**Tmavý režim:** existuje, přepínatelný; papír → tmavě sépiový, inkoust → krémový.

**Fonty:**
- Nadpisy: **Fraunces** (serif, knižní), letter-spacing −0.02em
- Text / UI: **Inter** (sans)
- Čísla, „eyebrow" štítky, mono popisky: **JetBrains Mono** (UPPERCASE, letter-spacing ~0.14em)

**Tvarosloví:**
- Karty / dlaždice: `border-radius` 12–22 px, jemný 1px okraj, lehký stín.
- Tlačítka: zaoblená; primární = plná akcentová oranžová + bílý text; ghost = průhledné s tenkým okrajem.
- „Pilulky" (badge): plně zaoblené (999), mono UPPERCASE.
- Hodně bílého prostoru, jemné stíny, žádné tvrdé čáry ani gradientové neony.
- Safe-area aware (mobil), výška `100dvh`.

---

## 3. Mapa obrazovek (co máme a k čemu slouží)

### A. Vstup a účet
- **Auth** (`/auth`) — přihlášení / registrace e-mailem. Jediná obrazovka bez přihlášení.
- **Reset hesla** (`/reset-password`) — nastavení nového hesla z e-mailu.
- **Účet** (`/account`) — profil: přezdívka (povinná, validovaná), jazyk, odhlášení. **Bez** statistik.
- **Nastavení přezdívky** — modální/krokový vstup, když hráč ještě nemá přezdívku.

### B. Menu (domovská — `/menu`)
Rozcestník. Mobil = svislý seznam, desktop = filmový hero + mřížka dlaždic.
- **Hlavička:** logo, vpravo přepínač jazyka (dropdown s vlaječkami), světlý/tmavý režim, odhlásit.
- **Pozdrav + level bar:** „VÍTEJ ZPĚT" + jméno hráče, „Level 3" + „3 899 / 7 500 XP" + tenký progress (oranžový gradient). V menu se ukazuje **jen XP/level** (ne počet her/bodů).
- **Hero dlaždice „Hrát klasickou hru":** velká karta. Na pozadí **slideshow ilustračních obrázků** událostí s pomalým Ken Burns zoomem a prolínáním. Velký serif titul + zlatý podtitul „🌿 Buď u toho, když se psaly dějiny." (s olivovými ratolestmi), vpravo dole kulaté oranžové tlačítko se šipkou.
- **Dlaždice režimů:** 📅 Tento den v historii (denní výzva) · 🎮 Více hráčů · 👤 Účet · 🏆 Skóre & progres · 👥 Přátelé (s notifikační pilulkou počtu žádostí) · (admin: ⚙️ Administrace).
  - Dlaždice denní výzvy navíc ukazuje **streak posledních 7 dní** (✓ odehráno / ✕ vynecháno) a když je dnešní hotová, **odpočet HH:MM:SS** do další.

### C. Herní tok (klasická hra)
- **Předsálí** (`/play`) — nastavení hry: počet kol, kategorie (multi-výběr), rozsah let (dvojitý slider). Tlačítko Hrát.
- **Hra** (`/game`) — plně pohlcující, tmavé pozadí.
  - **Na celé ploše 360° panorama** (otáčení, zoom). Při načítání tematická animace „hledající kompas".
  - Vlevo nahoře plovoucí bublina s názvem události (mono eyebrow + serif název) — vždy viditelná.
  - **Horní HUD:** „KOLO 1 / 5" vlevo; vpravo skóre + „✕ Skončit" (otevře **potvrzovací modal** „Ukončit hru?").
  - **Dole:** dlaždice **Mapa** (mini náhled → rozbalí se na celou obrazovku s tažitelným pinem a křížkem) a dlaždice **Rok** (→ spodní panel s posuvníkem: modrá = př. n. l., oranžová = n. l., ±1/±10, přímý input) + tlačítko **Odeslat**. Splněné dlaždice mají zelený okraj.
  - **Výsledek kola:** karta přes obrazovku se **záložkami 🏆 Skóre / 📖 O události**. Skóre: mapa s tvým tipem (oranžový pin) a správným místem (zelený pin) + spojnice + karty Poloha / Rok s body a progresem. Info: obrázek + popis události + hodnocení panoramatu hvězdami.
  - **Konec hry:** souhrn skóre + získané XP/level + nově odemčené achievementy.

### D. Denní výzva (`/daily`) — „Tento den v historii"
- 1 kolo, **časovač 60 s**, jen 1 pokus za den. (Rychlost = **XP násobič**: zbylý čas / 10.)
- **Výsledek:** záložky 🏆 Skóre / 📖 O události + **žebříček dne** (top hráči) + **histogram** rozložení skóre (na mobilu v bottom-sheet modalu) + vyhodnocení XP. Po odehrání jde info číst kdykoli.

### E. Více hráčů (multiplayer)
- **Lobby** (`/multiplayer/lobby`) — vytvoření/připojení místnosti 5-místným kódem; nastavení (kola, čas, kategorie, rozsah let, režim Klasický / ☠️ Battle Royale); seznam hráčů (max 12).
- **Hra** (`/multiplayer/game/:roomId`) — jako klasická hra + odpočet 3-2-1 mezi koly; po kole „Moje výsledky" → „Žebříček kola" (kruhový timer).

### F. Skóre & progres (`/stats`)
- Hlavička s levelem a XP progresem.
- Sekce: **Přehled** (hry, skóre, průměr, trefy), **Přesnost** (průměrná vzdálenost/rok, % blízko, % přesný rok), **Denní výzva** (série, počet), **Kalendář denní výzvy** (celý rok: ✓ odehráno / ✕ vynecháno), **Trend** (graf vývoje skóre), **Achievementy** (8 kategorií × 8 stupňů, rozklikávací žebříček titulů).

### G. Přátelé (`/friends`)
- Přidání podle přezdívky, příchozí žádosti (přijmout/odmítnout), seznam přátel s úrovní.

### H. Administrace (Czech-only, utilitární — ne „pěkné" jako hráčská část)
- **Rozcestník** (`/admin`) — dlaždice: Správa událostí, Hromadné AI zadávání, Hromadný import, Denní výzvy, Reporting.
- **Správa událostí** (`/admin/events`) — tabulka + filtry (hledání, multi-kategorie, stav publikace), velikosti souborů; formulář události (CRUD, EN/DE překlady, GPS mapa, komprese, AI předvyplnění dat, AI generování panoramatu/ilustrace, náhledy).
- **Hromadné AI zadávání** (`/admin/bulk-ai`) — AI navrhne N událostí (mezery v pokrytí, série/kampaně), schválení, AI dogenerování dat → uložení jako drafty.
- **Hromadný import** (`/admin/import`) — CSV/XLS šablony + export (vč. EN/DE).
- **Denní výzvy** (`/admin/daily`) — roční kalendář, přiřazení události ke dni.
- **Reporting** (`/admin/reports`) — KPI + grafy (uživatelé, kategorie, denní výzva, multiplayer).

### I. Právní
- **Privacy** (`/privacy`), **Terms** (`/terms`) — placeholdery.

---

## 4. Co po Claude chci
> (Sem dopiš konkrétně, např.:)
> „Navrhni mi modernější/čistší vizuál **menu** a **herní obrazovky** v tomhle stylu.
> Zachovej paletu a serif+mono mix. Ukaž 2–3 varianty hero dlaždice a layoutu
> herního HUDu. Mobile-first. Drž se palety a fontů výše."

## 5. Tip na zadání
1. Vlož tenhle brief.
2. Přilož **screenshoty** menu + hra + výsledek + denní výzva (klidně light i dark).
3. Řekni **co konkrétně** chceš (redesign menu? jen hero? celý vizuální jazyk?).
4. Drž návrh u **palety a fontů** výše, ať výstup ladí s tím, co už máš.
