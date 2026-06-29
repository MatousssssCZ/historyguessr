# HistoryGuessr — Claude Code Context

## O projektu
Vzdělávací geolokační hra inspirovaná GeoGuessrem. Hráč vidí 360° panoramu historického místa a tipuje kde na světě se nachází a v jakém roce se událost odehrála.

**Live URL:** https://historyguessr.vercel.app  
**GitHub:** https://github.com/MatousssssCZ/historyguessr  
**Hosting:** Vercel (automatický deploy z main branch)

---

## Stack

| Vrstva | Technologie |
|--------|-------------|
| Frontend | React 18 + Vite + TypeScript |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Mapy | Leaflet.js + CartoDB Voyager tiles |
| 360° | Pannellum.js (hfov: 120, pevně) |
| Styling | CSS variables (globals.css), inline styles |
| Deploy | GitHub → Vercel CI/CD |

---

## Supabase

```
URL:      https://wgiijdnoiiuxxucacyio.supabase.co
Projekt:  wgiijdnoiiuxxucacyio
Admin:    bahnik.matous2@gmail.com (role = 'admin' v DB)
```

**ENV proměnné** (v `.env.local` a Vercel):
```
VITE_SUPABASE_URL=https://wgiijdnoiiuxxucacyio.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnaWlqZG5vaWl1eHh1Y2FjeWlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzgyNDgsImV4cCI6MjA5MzQxNDI0OH0.vk8rDFt86H_v0WjcGimbfS4BmTnwa9pfWqWP9tgKuaY
```

---

## Databázové schéma

### `profiles`
- `id` uuid (FK → auth.users)
- `username` text
- `role` text ('player' | 'admin')
- `games_played` int
- `total_score` int
- `created_at` timestamptz

### `events`
- `id` uuid, `seq` int (čitelné pořadové číslo — migrace 010)
- `title` text, `description` text
- `title_en/title_de`, `description_en/description_de` text (překlady, fallback na CZ)
- `year` int (střed rozsahu)
- `year_from` int, `year_to` int (rozsah pro bodování)
- `lat` float, `lng` float
- `panorama_url` text (bucket `panorama`, soubor `${id}/panorama.webp`)
- `preview_url` text (malý náhled `${id}/preview.webp` — migrace 012)
- `event_image_url` text (bucket `events`)
- `category` text
- `difficulty` int (1–3)
- `hfov` int (výchozí zoom panoramy)
- `published` boolean
- `play_count` int
- `location_radius_km` float, `year_range` int
- `rating_sum/rating_count`, `score_*` agregáty
- `created_by` uuid

### `game_sessions`
- `id` uuid
- `user_id` uuid
- `rounds` jsonb
- `total_score` int
- `finished_at` timestamptz

### `analytics_events`
- `id` uuid
- `user_id` uuid
- `event_name` text
- `properties` jsonb
- `created_at` timestamptz

### `daily_challenge_assignments`
- `month` int, `day` int (PRIMARY KEY)
- `event_id` uuid (FK → events)
- `updated_at` timestamptz

### `daily_results`
- `id` uuid
- `user_id` uuid
- `date` date
- `score` int
- `guess_lat` float, `guess_lng` float, `guess_year` int
- `created_at` timestamptz
- UNIQUE(user_id, date)

### `multiplayer_rooms`
- `id` uuid
- `code` char(5) UNIQUE
- `host_id` uuid
- `status` text ('waiting' | 'playing' | 'finished')
- `current_round` int
- `settings` jsonb `{rounds, time_limit, categories[], year_from, year_to}`
- `created_at`, `updated_at` timestamptz

### `multiplayer_players`
- `room_id` uuid, `user_id` uuid (PRIMARY KEY)
- `username` text
- `total_score` int
- `is_host` boolean

### `multiplayer_rounds`
- `room_id` uuid, `round_number` int (PRIMARY KEY)
- `event_id` uuid
- `started_at` timestamptz (null = ještě nezačalo)

### `multiplayer_answers`
- `room_id` uuid, `round_number` int, `user_id` uuid (PRIMARY KEY)
- `guess_lat`, `guess_lng` float, `guess_year` int
- `location_score`, `year_score`, `round_score` int

---

## Struktura projektu

```
src/
├── components/
│   ├── GameMap.tsx        — GuessMap (compact prop), ResultMap
│   ├── AdminMap.tsx
│   ├── BackButton.tsx     — jednotný výrazný návratový prvek (akcent)
│   ├── YearRange.tsx      — sdílený dvojitý slider rozsahu let (solo + MP)
│   ├── LanguageSwitcher.tsx — přepínač CS/EN/DE
│   ├── ThemeToggle.tsx    — světlý/tmavý režim
│   └── ErrorBoundary.tsx  — záchrana proti bílé obrazovce
├── hooks/
│   ├── useAuth.tsx        — user, profile, isAdmin
│   └── useGame.ts         — herní smyčka pro solo hru
├── i18n/
│   ├── index.ts           — i18next config, currentLocale(), setLanguage()
│   └── resources.ts       — překlady CS/EN/DE (namespaces)
├── lib/
│   ├── supabase.ts        — DB/Storage helpery + track() + daily funkce
│   ├── scoring.ts         — haversineKm, roundScore, yearDiff, formatYear
│   ├── multiplayer.ts     — multiplayer funkce + Realtime subscriptions
│   ├── eventLocale.ts     — eventTitle()/eventDescription() dle jazyka (fallback CS)
│   ├── preload.ts         — preloadImage() pro prefetch panoramat
│   ├── leveling.ts        — XP / úrovně
│   └── imageCompression.ts — Canvas WebP komprese + generatePreview()
├── pages/
│   ├── Auth.tsx           — přihlášení/registrace
│   ├── Menu.tsx           — hlavní menu
│   ├── PreGameLobby.tsx   — předsálí solo hry (/play): kola, kategorie, roky
│   ├── Game.tsx           — solo herní smyčka
│   ├── Daily.tsx          — "Tento den v historii" (1 kolo, timer 60s)
│   ├── Stats.tsx          — statistiky hráče (/stats)
│   ├── MultiplayerLobby.tsx — vytvoření/připojení místnosti + nastavení
│   ├── MultiplayerGame.tsx  — multiplayer herní smyčka
│   ├── Admin.tsx          — správa událostí (CRUD, komprese, preview, EN/DE, batch náhledy)
│   ├── AdminImport.tsx    — hromadný import CSV/XLS
│   ├── AdminDailyChallenge.tsx — kalendář denních výzev
│   ├── Account.tsx        — profil uživatele (bez statistik)
│   ├── ResetPassword.tsx  — nastavení nového hesla
│   ├── Privacy.tsx        — zásady ochrany údajů (placeholder)
│   └── Terms.tsx          — podmínky použití (placeholder)
└── types/
    └── database.ts
```

> Pozn.: admin formulář událostí je inline `EventForm` v `Admin.tsx`
> (samostatný `AdminEventForm.tsx` byl smazán jako mrtvý kód).

---

## Routes (App.tsx)

Admin routy chrání `RequireAdmin`, ostatní `RequireAuth`. Admin/MP stránky
jsou líně načítané (`React.lazy`).

```
/                     → redirect (menu nebo auth)
/auth                 → AuthPage
/auth/callback        → RootRedirect (cíl e-mail potvrzení)
/reset-password       → ResetPasswordPage
/menu                 → MenuPage
/play                 → PreGameLobbyPage (předsálí solo)
/game                 → GamePage (solo)
/daily                → DailyChallengePage
/stats                → StatsPage
/account              → AccountPage
/admin                → AdminPage           (RequireAdmin)
/admin/import         → AdminImportPage      (RequireAdmin)
/admin/daily          → AdminDailyChallengePage (RequireAdmin)
/multiplayer/lobby    → MultiplayerLobbyPage
/multiplayer/game/:roomId → MultiplayerGamePage
/privacy              → PrivacyPage
/terms                → TermsPage
```

---

## Bodovací systém (scoring.ts)

Exponenciální pokles, **MAX_SCORE = 500** za složku:

- **Poloha:** `500 · e^(−max(0, distKm − radiusKm) / 1500)`
- **Rok:** `500` v rozsahu `[year_from, year_to]`, jinak `500 · e^(−roky_mimo / 240)`
- **Max za kolo:** 1 000 bodů (500 + 500)

V multiplayeru skóre počítá a ukládá **server** (RPC `submit_multiplayer_answer`,
migrace 014) — stejný vzorec, klient posílá jen tip.

---

## Klíčové UX detaily

### Mobilní hra (Game.tsx)
- Dvě dlaždice: mapa (živá Leaflet, 88px kruh → rozbalí se fullscreen) + rok
- Rok picker: slider −3000 až 2025, modrá = př. n. l., oranžová = n. l., ±10/±1 tlačítka, přímý input
- Výsledková karta: `position: fixed` přes celou obrazovku
- Prefetch další panoramy: `<link rel="preload">` při zobrazení výsledků

### Daily Challenge
- 1 kolo, limit 60 sekund, pouze 1 pokus za den
- Synchronizace: `started_at` timestamp + klientský odpočet
- Výsledky: leaderboard + histogram distribuce skóre (mobil: v bottom sheet modalu)

### Multiplayer
- Max 12 hráčů, 5-místný alfanumerický kód (bez 0, 1, O, I)
- Supabase Realtime pro sync lobby a hry
- Synchronizace kola: host nastaví `started_at = now() + 3s`, klienti odpočítají
- Flow výsledků: Moje výsledky (manuální přechod) → Žebříček kola (kruhový timer 8s) → Další kolo

### Admin
- Komprimace panoramat: Canvas → WebP, target 3–6 MB, max 8192×4096
- Preview panoramy: Pannellum modal před uložením
- Bezpečné nahrazení: upload → DB update → smazání starého souboru

---

## Design systém

```css
/* Barvy */
--sepia-900: #2a1f17  /* tmavé pozadí */
--paper-50:  #faf7f0  /* světlé pozadí */
--accent:    #d97757  /* oranžová */

/* Fonty */
--font-serif: 'Fraunces'
--font-sans:  'Inter'
--font-mono:  'JetBrains Mono'

/* Safe area */
env(safe-area-inset-top/bottom)
100dvh místo 100vh
```

---

## Analytics eventy (track())

`sign_up`, `login`, `game_started`, `guess_submitted`, `game_completed`, `panorama_rating_submitted`, `daily_challenge_started`, `daily_challenge_completed`, `admin_event_created`, `admin_event_updated`, `panorama_replaced`, `panorama_delete_failed`

---

## Aktuální stav & TODO

### ✅ Hotové
- Solo hra, Daily Challenge, Multiplayer (lobby, sync, výsledky)
- i18n CS/EN/DE (UI + popisy událostí přes title_en/de)
- Admin panel (CRUD, bulk import, komprese, preview náhledy + batch)
- Prefetch panoramat + preview (okamžité zobrazení)
- Server-authoritativní skóre v MP (RPC 014), úklid místností (013)
- RequireAdmin guard, ErrorBoundary, lazy-load admin/MP rout
- Analytics, PWA manifest

### 🗄️ Migrace (Supabase SQL editor — idempotentní)
`001`–`009` základ · `010` seq · `011` MP realtime · `012` preview_url
· `013` úklid MP (pg_cron volitelný) · `014` server skóre MP
+ ruční ALTER pro title_en/de, description_en/de.

### 🔲 TODO / Známé problémy
- Privacy/Terms: doplnit `[email]` a `[jméno/firma]` (placeholdery)
- Skóre solo/daily je stále client-trusted (MP už ne) — případně server-side
- Screenshot sdílení výsledků (Web Share API)
- Volitelně: pg_cron pro úklid MP (jinak `select cleanup_multiplayer()` ručně)

---

## Časté příkazy

```bash
npm run dev          # lokální development
npm run build        # produkční build
git add -A && git commit -m "..." && git push  # deploy (Vercel auto-deploy)
```

---

## Pravidla pro Claude Code

1. **Nikdy neměň** `scoring.ts` bez explicitního požadavku — bodování je záměrné
2. **Vždy používej** CSS variables místo hardcoded barev
3. **Safe area** — vždy `env(safe-area-inset-*)` a `100dvh`
4. **Panorama hfov** — vždy pevně 120, nikdy jako nastavitelná hodnota
5. **TypeScript** — žádné `any` pokud to není nezbytné
6. **Git commit** před každou větší změnou
7. **Testuj build** (`npm run build`) před pushem
