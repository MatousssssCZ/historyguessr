# HistoryGuessr

Vzdělávací geolokační hra — tipuj místo a rok historické události z 360° panoramy.

## Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Backend**: Supabase (Auth, PostgreSQL, Storage, RLS)
- **Deploy**: GitHub → Vercel

---

## Rychlý start

### 1. Klonuj repozitář

```bash
git clone https://github.com/TVUJ_USERNAME/historyguessr.git
cd historyguessr
npm install
```

### 2. Nastav Supabase

1. Jdi na [supabase.com](https://supabase.com) a vytvoř nový projekt
2. V **SQL Editor** spusť migrační soubory v pořadí:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_rls.sql`
   - `supabase/migrations/003_storage.sql`

### 3. Nastav proměnné prostředí

```bash
cp .env.example .env.local
```

Doplň hodnoty z **Supabase → Settings → API**:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 4. Spusť lokálně

```bash
npm run dev
```

### 5. Nastav admin účet

Po registraci prvního účtu ho ručně povýš na admina v Supabase:

```sql
update public.profiles set role = 'admin' where id = 'TVOJE_USER_ID';
```

User ID najdeš v **Supabase → Authentication → Users**.

---

## Deploy na Vercel

1. Propoj GitHub repozitář s Vercel
2. Přidej environment variables (stejné jako `.env.local`)
3. Vercel automaticky deployuje při každém push do `main`

---

## Struktura projektu

```
src/
├── pages/         # Auth, Menu, Game, Account, Admin
├── hooks/         # useAuth, useGame
├── lib/           # supabase.ts, scoring.ts
├── types/         # TypeScript typy z DB schématu
└── styles/        # globals.css (design system)

supabase/
└── migrations/    # SQL migrační soubory
```

---

## Přidání historické události

1. Přihlaš se admin účtem
2. Jdi do **Správa událostí** (v menu se zobrazí pouze adminům)
3. Vyplň formulář: název, popis, rok, souřadnice, nahraj panorama a obrázek
4. Zaškrtni **Publikovat** — událost se okamžitě zobrazí hráčům

### Formát panoramy

- Formát: equirectangular (standardní 360° formát)
- Rozlišení: doporučeno 4096×2048 nebo vyšší
- Soubor: JPG nebo PNG, max 50 MB

---

## Bezpečnost

- RLS na všech DB tabulkách
- Admin role se přiděluje pouze ručně v DB
- Score validace přes DB trigger (zabraňuje cheatu)
- CSP headers v `vercel.json`
- Žádné service role keys na frontendu
