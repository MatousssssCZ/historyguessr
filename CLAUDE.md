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
- `id` uuid
- `title` text
- `description` text
- `year` int (střed rozsahu)
- `year_from` int, `year_to` int (rozsah pro bodování)
- `lat` float, `lng` float
- `panorama_url` text (Supabase Storage: bucket `panorama`)
- `event_image_url` text (Supabase Storage: bucket `events`)
- `category` text
- `difficulty` text
- `published` boolean
- `play_count` int
- `location_radius_km` float
- `rating_sum` int, `rating_count` int
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
│   └── AdminMap.tsx
├── hooks/
│   ├── useAuth.tsx        — user, profile, isAdmin
│   └── useGame.ts         — herní smyčka pro solo hru
├── lib/
│   ├── supabase.ts        — všechny DB/Storage helpery + track() + daily funkce
│   ├── scoring.ts         — haversineKm, roundScore, yearDiff
│   ├── multiplayer.ts     — multiplayer funkce + Realtime subscriptions
│   └── imageCompression.ts — Canvas WebP komprimace panoramat
├── pages/
│   ├── Auth.tsx           — přihlášení/registrace (mobil: fullscreen, desktop: split)
│   ├── Menu.tsx           — hlavní menu (dark hero + dlaždice)
│   ├── Game.tsx           — solo herní smyčka (5 kol)
│   ├── Daily.tsx          — "Tento den v historii" (1 kolo, timer 60s, leaderboard)
│   ├── MultiplayerLobby.tsx — vytvoření/připojení místnosti + nastavení
│   ├── MultiplayerGame.tsx  — multiplayer herní smyčka
│   ├── Admin.tsx          — správa událostí (CRUD, preview panoramy)
│   ├── AdminImport.tsx    — hromadný import CSV/XLS
│   ├── AdminDailyChallenge.tsx — kalendář přiřazení denních výzev
│   ├── Account.tsx        — profil uživatele
│   ├── Privacy.tsx        — zásady ochrany údajů (placeholder)
│   └── Terms.tsx          — podmínky použití (placeholder)
└── types/
    └── database.ts
```

---

## Routes (App.tsx)

```
/                     → redirect (menu nebo auth)
/auth                 → AuthPage
/menu                 → MenuPage
/game                 → GamePage (solo)
/daily                → DailyChallengePage
/account              → AccountPage
/admin                → AdminPage
/admin/import         → AdminImportPage
/admin/daily          → AdminDailyChallengePage
/multiplayer/lobby    → MultiplayerLobbyPage
/multiplayer/game/:roomId → MultiplayerGamePage
/privacy              → PrivacyPage
/terms                → TermsPage
```

---

## Bodovací systém (scoring.ts)

- **Poloha:** `max(0, 5000 - distKm - radiusKm)` bodů
- **Rok:** `max(0, 5000 - roků_mimo_rozsah)` bodů
- **Max za kolo:** 10 000 bodů (5 kol = 50 000 celkem)

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
- Solo hra (5 kol, tipování místa + roku, výsledky)
- Auth (registrace, přihlášení)
- Admin panel (CRUD, bulk import, panorama preview, komprimace)
- Daily Challenge (kalendář, gameplay s timerem, leaderboard, histogram)
- Multiplayer (lobby, nastavení, sync, výsledky)
- Analytics (Supabase tracking)
- Legal pages (placeholdery)
- PWA manifest

### 🔲 TODO / Známé problémy
- Multiplayer: "Založit hru" nefunguje — debugging in progress (tabulky existují, soubory na GitHubu)
- Screenshot sdílení výsledků (html2canvas nebo Web Share API)
- Privacy/Terms: doplnit [email] a [jméno/firma]
- Multiplayer: chybí `increment_multiplayer_score` RPC funkce v Supabase (fallback existuje)

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
