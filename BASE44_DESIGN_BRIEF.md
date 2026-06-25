# HistoryGuessr — design brief pro Base44

> Vlož tenhle text do Base44 jako zadání. **Navíc nahraj screenshoty** (menu, hra,
> výsledky) — vizuální reference je nejsilnější signál, text ji jen doplňuje.

---

## 1. Co to je
**HistoryGuessr** — vzdělávací hra à la GeoGuessr, ale s historií. Hráč vidí 360°
panorama historického místa a hádá **kde na světě** to je (pin do mapy) a **v jakém
roce** se to stalo (posuvník). Mobile-first, hraje se i na desktopu. Jazyky: CS/EN/DE.

**Vibe / nálada:** „historický deník / starý atlas" — papírová sépiová paleta,
serifové nadpisy, decentní, klidné, ne křiklavé. Prémiový, knižní, vzdělávací pocit.
Ne gamingově neonové.

---

## 2. Design systém (přesné hodnoty)

**Barvy — světlý režim (výchozí):**
- Pozadí papír: `#faf7f0` (hlavní), `#f5f1e8`, `#ebe4d4` (jemné odstíny)
- Text (inkoust): `#2a1f17` (hlavní), `#5a4632` (sekundární), `#9b8167` (tlumený)
- **Akcent (oranžová terakota):** `#d97757`, tmavší `#b85a3e`, světlejší `#e89a82`
- Zlatá (dekor/akcenty nadpisů): `#f5ce8b`
- Úspěch/zelená (správné místo, kladné stavy): `#5c9468` / `#3f7a4d`
- Linky/oddělovače: `rgba(42,31,23,0.10)`

**„Feature" plochy (tmavé sekce — hlavička menu, hero):** pozadí `#2a1f17`,
text `#f5f1e8`. (V tmavém režimu se celá appka invertuje.)

**Tmavý režim:** existuje, přepínatelný; papír → tmavě sépiový, inkoust → krémový.

**Fonty:**
- Nadpisy: **Fraunces** (serif, výrazný, knižní) — velké tituly, letter-spacing −0.02em
- Text/UI: **Inter** (sans)
- Čísla, štítky, „eyebrow" popisky: **JetBrains Mono** (mono, UPPERCASE, letter-spacing ~0.14em)

**Tvarosloví:**
- Karty/dlaždice: `border-radius` 14–22 px, jemný 1px okraj `rgba(42,31,23,0.1)`, lehký stín.
- Tlačítka: zaoblená; primární = plná akcentová oranžová + bílý text + měkký stín;
  ghost = průhledné s tenkým okrajem.
- „Pilulky" (badge/štítky): plně zaoblené (`border-radius: 999`), mono UPPERCASE text.
- Hodně **bílého prostoru**, jemné stíny, žádné tvrdé čáry.
- Safe-area aware (mobil), `100dvh`.

---

## 3. Klíčové obrazovky

### MENU (domovská)
Mobil = svislý seznam, desktop = filmový hero + mřížka dlaždic.
- **Hlavička:** logo „HistoryGuessr" (vlevo), vpravo přepínač jazyka (dropdown s vlaječkami),
  přepínač světlý/tmavý režim, „Odhlásit".
- **Pozdrav:** „VÍTEJ ZPĚT" (mono eyebrow) + velké jméno hráče (Fraunces).
- **Level bar:** „Level 3" + „3 899 / 7 500 XP" + tenký progress proužek (oranžový gradient).
- **Hero dlaždice „Hrát klasickou hru":** velká karta s **fotkou historické události**
  na pozadí (tmavý scrim přes spodek), velký serif titul bílý, pod ním zlatý podtitul
  „🌿 Historie čeká. Kam tě zavede příště? 🌿" (s olivovými ratolestmi), vpravo dole
  kulaté oranžové tlačítko se šipkou →.
- **Seznam režimů (dlaždice/řádky):** 📅 Tento den v historii (denní výzva, vpravo
  pilulka „NOVÁ VÝZVA"), 🎮 Více hráčů, 🏆 Skóre & progres, 👥 Přátelé (s notifikační
  pilulkou počtu žádostí), (admin: ⚙️ Administrace). Každý řádek: ikona ve čtvercové
  dlaždici + serif název + tlumený podtitul + šipka „›".

### HRA (klasická / 1 kolo)
Plně pohlcující, tmavé pozadí (`#0d0906`).
- **Na celé ploše 360° panorama** (lze otáčet, zoom). Vlevo nahoře plovoucí bublina
  s názvem události (mono eyebrow „HISTORICKÁ UDÁLOST" + serif název) — zůstává viditelná
  i přes překryvy.
- **Horní HUD (kompaktní):** „KOLO 1 / 5" (mono, oranžová) vlevo; vpravo skóre a tlačítko
  „✕ Skončit". Pod tím tenký časový progress proužek (jen u časovaných režimů).
- **Dole dvě dlaždice (vedle sebe) + tlačítko Odeslat:**
  - dlaždice **Mapa** — mini náhled mapy; po tapnutí se rozbalí na **celou obrazovku**
    (Leaflet mapa, pin tažitelný) s kulatým křížkem ✕ vpravo nahoře a potvrzovacím pruhem dole.
  - dlaždice **Rok** — zobrazí zvolený rok; po tapnutí spodní panel s **posuvníkem roku**
    (−3000…2025): modrá část = př. n. l., oranžová = n. l., velký uchopitelný „čudlík",
    tlačítka ±1/±10 a přímý input.
  - splněné dlaždice mají **zelený** okraj (✓).
- **Výsledek kola (po odeslání):** karta přes obrazovku, nahoře název + skóre („850 b. / z 1 000"),
  záložky **🏆 Skóre** a **📖 Info o události**. Skóre: mapa s **tvým tipem (oranžový pin)**
  a **správným místem (zelený pin)** + spojnice + dvě karty (Poloha / Rok) s body a progresem.
  Info: obrázek události, název, popis, hodnocení panoramatu hvězdami.

### DALŠÍ OBRAZOVKY (stručně, stejný jazyk)
- **Denní výzva:** 1 kolo, 60s časovač, po odehrání žebříček dne + histogram skóre + „Tvůj postup" (XP/level + odemčené achievementy).
- **Multiplayer lobby:** 5místný kód, seznam hráčů, nastavení (počet kol, čas, kategorie, rozsah let, režim Klasický/☠️ Battle Royale).
- **Multiplayer hra:** jako klasická hra + odpočet 3-2-1 mezi koly, žebříček kola s kruhovým časovačem.
- **Skóre/statistiky:** karty (hry, skóre, přesnost), graf vývoje, achievementy po kategoriích (rozklikávací žebříček titulů).
- **Přátelé:** přidání podle přezdívky, příchozí žádosti (přijmout/odmítnout), seznam přátel s úrovní.
- **Admin:** rozcestník s dlaždicemi (Správa událostí, Import, Denní výzvy, Reporting) — drž česky, utilitární, ne tak „pěkné" jako hráčská část.

---

## 4. Co po Base44 chci
> (Sem dopiš konkrétně, např.:)
> „Navrhni mi modernější/čistší vizuál **menu** a **herní obrazovky** v tomhle stylu.
> Zachovej paletu a serif+mono mix. Ukaž mi 2–3 varianty hero dlaždice a layoutu
> herního HUDu. Mobile-first."

---

## 5. Tip na zadání
1. Vlož tenhle brief.
2. Nahraj **screenshoty** menu + hry + výsledků (klidně i light/dark).
3. Řekni, **co konkrétně** chceš (redesign menu? jen hero? celý vizuální jazyk?).
4. Drž ho u **palety a fontů výše**, ať výstup ladí s tím, co už máš.
