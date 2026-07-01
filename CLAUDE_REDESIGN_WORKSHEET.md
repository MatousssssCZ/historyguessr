# HistoryGuessr — pracovní list pro redesign (Claude design → implementace)

> Cíl: projít s Claude design **obrazovku po obrazovce**, u každé získat návrh
> v podobě, kterou lze rovnou převést do kódu. Tenhle soubor je zároveň
> zadání pro Claude design i místo, kam lepit jeho výstup pro mě k implementaci.

---

## 0. Jak s Claude design pracovat (přečti první)

**Vždy mu dej tři věci ke každé obrazovce:**
1. **Účel + klíčové prvky** (co nesmí zmizet) — viz sekce níže.
2. **Screenshot** aktuálního stavu (ideálně mobil i desktop, light i dark).
3. **Omezení** (technická realita, viz „Tvrdá pravidla").

**Vyžádej si od něj výstup takto (důležité pro implementaci):**
> „Výstup dej jako **jeden HTML/CSS artifact** pro tuhle obrazovku. Používej
> **CSS proměnné** z palety (`--paper-50`, `--ink`, `--accent` …), ne natvrdo
> hex. Zachovej **stejnou strukturu komponent a stejné texty**, měň jen vizuál
> a rozvržení. Ke každé změně napiš 1 větu proč. Mobile-first, ukaž i desktop."

Proč HTML/CSS artifact: appka je **React + inline styly**, takže z kódu Claude
design přenesu hodnoty (spacing, barvy, radiusy, layout) 1:1. Samotné obrázky
mi stačí jako reference, ale kód = nejrychlejší a nejpřesnější implementace.

**Postup po fázích (doporučené pořadí):**
1. Nejdřív **vizuální jazyk** na 2 nosných obrazovkách: **Menu** a **Hra**.
   Až se shodneme na jazyce (barvy, karty, tlačítka, typografie), zbytek z něj vyplyne.
2. Pak **Výsledek kola / Denní výzva** (nejvíc obsahu na ploše).
3. Pak zbývající hráčské obrazovky (Statistiky, Přátelé, Multiplayer, Předsálí, Účet/Auth).
4. Administraci nech utilitární — redesign nízká priorita.

---

## 1. Tvrdá pravidla (řekni Claude design, ať je drží)

- **Paleta a fonty zůstávají** (Fraunces / Inter / JetBrains Mono; sépiová + terakota). Viz `CLAUDE_DESIGN_BRIEF.md`.
- **Světlý i tmavý režim** — každá barva musí fungovat v obou (proto CSS proměnné).
- **Mobile-first**, `100dvh`, safe-area.
- **Panorama hfov je pevné** (nemění se) — herní plocha musí nechat panorama na celé obrazovce.
- **Bodování a herní logika se nemění** — jen vizuál.
- Ikonky/emoji, které používáme, můžou zůstat (📅 🎮 🏆 👥 🗺️ …) nebo je nahraď konzistentní sadou — ať je to jednotné.

---

## 2. Screenshoty — jak je pořídit

Nejlíp v tvém prohlížeči na živé appce (**historyguessr.vercel.app**), přihlášený.
Ke každé obrazovce ideálně 4 varianty: **mobil light, mobil dark, desktop light, desktop dark**
(dark přepneš přepínačem v hlavičce; mobil = zúžit okno / dev-tools device mode).

> Pokud chceš, můžu ti screenshoty pořídit já přes prohlížeč — ale appka je za
> přihlášením, takže bych potřeboval buď tvoje přihlášení, nebo je nasnímat sám.
> Napiš, jestli to chceš.

---

## 3. Obrazovky — účel a klíčové prvky

Ke každé: **Účel**, **Nesmí zmizet**, a prázdné **NÁVRH (sem vlož výstup Claude design)**.

### 3.1 Menu (`/menu`) — priorita 1
- **Účel:** rozcestník; první dojem, drží vizuální jazyk.
- **Nesmí zmizet:** hero „Hrát" se slideshow obrázků + tlačítko; level/XP bar; dlaždice režimů (denní výzva se streakem 7 dní + odpočtem, multiplayer, skóre, přátelé s notifikací, admin); přepínač jazyka + light/dark; jméno hráče.
- **NÁVRH:**

### 3.2 Hra (`/game`) — priorita 1
- **Účel:** pohlcující hádání na 360° panoramatu.
- **Nesmí zmizet:** panorama na celé ploše; HUD (kolo X/Y, skóre, ✕ Skončit → potvrzovací modal); plovoucí název události; dlaždice Mapa (→ fullscreen s pinem) a Rok (→ posuvník −3000…2025) + Odeslat; loading animace.
- **NÁVRH:**

### 3.3 Výsledek kola (v `/game`) — priorita 2
- **Účel:** ukázat body + poučit.
- **Nesmí zmizet:** záložky 🏆 Skóre / 📖 O události; mapa s tvým (oranžový) a správným (zelený) pinem + spojnice; karty Poloha / Rok; obrázek + popis; hodnocení hvězdami; tlačítko dál.
- **NÁVRH:**

### 3.4 Denní výzva (`/daily`) — priorita 2
- **Účel:** 1 kolo/den, časovka, komunitní žebříček.
- **Nesmí zmizet:** 60s časovač; výsledek se záložkami Skóre / O události; žebříček dne; histogram skóre; XP (vč. rychlostního násobiče); odpočet do další výzvy.
- **NÁVRH:**

### 3.5 Statistiky (`/stats`) — priorita 3
- **Účel:** progres a sběratelství.
- **Nesmí zmizet:** level/XP hlavička; sekce Přehled, Přesnost, Denní výzva, **Kalendář denní výzvy** (rok, ✓/✕), Trend (graf), Achievementy (rozklikávací).
- **NÁVRH:**

### 3.6 Multiplayer — lobby + hra — priorita 3
- **Nesmí zmizet:** 5-místný kód; seznam hráčů; nastavení (kola, čas, kategorie, rozsah let, režim Klasický/Battle Royale); mezikolní odpočet; žebříček kola.
- **NÁVRH:**

### 3.7 Předsálí solo (`/play`) — priorita 3
- **Nesmí zmizet:** počet kol, kategorie (multi), rozsah let (dvojitý slider), Hrát.
- **NÁVRH:**

### 3.8 Přátelé (`/friends`) — priorita 3
- **Nesmí zmizet:** přidání dle přezdívky; příchozí žádosti (přijmout/odmítnout); seznam přátel s úrovní.
- **NÁVRH:**

### 3.9 Účet / Auth / Reset — priorita 4
- **Nesmí zmizet:** přihlášení/registrace; přezdívka (validace); jazyk; odhlášení.
- **NÁVRH:**

### 3.10 Administrace — priorita 5 (nechat utilitární)
- Jen sjednotit, ne „hezčit". **NÁVRH:**

---

## 4. Handoff zpět ke mně (implementace)

Až budeš mít od Claude design hotové obrazovky, dej mi je jednou z těchto forem
(od nejlepší po nejhorší pro rychlost/přesnost):
1. **HTML/CSS artifacty** (nejlepší) — přilep sem do sekcí „NÁVRH" nebo pošli soubory.
2. **Spec** — přesné hodnoty (barvy z palety, spacing v px, radiusy, struktura).
3. **Obrázky + poznámky** — funguje, ale detaily (přesné rozestupy) budu odhadovat.

Pak řekni „implementuj obrazovku X" a já to převedu do React + inline stylů,
po jedné obrazovce, s buildem a nasazením jako obvykle.
