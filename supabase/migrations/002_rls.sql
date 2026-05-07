-- HistoryGuessr · Migrace 002 · Row Level Security
-- Spusť AFTER 001_schema.sql

-- ── Povolení RLS na všech tabulkách ──────────────────────
alter table public.profiles      enable row level security;
alter table public.events        enable row level security;
alter table public.game_sessions enable row level security;

-- ═══════════════════════════════════════════════════════
-- PROFILES
-- ═══════════════════════════════════════════════════════

-- Kdokoliv (i nepřihlášený) může vidět základní veřejné profily
-- (pro leaderboard v budoucnu — zatím omezeno na vlastní)
create policy "profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

-- Přihlášený uživatel může editovat vlastní profil
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Uživatel si nesmí sám nastavit admin roli
    and (role = 'user' or (select role from public.profiles where id = auth.uid()) = 'admin')
  );

-- ═══════════════════════════════════════════════════════
-- EVENTS
-- ═══════════════════════════════════════════════════════

-- Veřejné čtení publishovaných událostí
create policy "events: public select published"
  on public.events for select
  using (published = true);

-- Admin vidí vše
create policy "events: admin select all"
  on public.events for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Admin může vkládat
create policy "events: admin insert"
  on public.events for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Admin může editovat
create policy "events: admin update"
  on public.events for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Admin může mazat
create policy "events: admin delete"
  on public.events for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ═══════════════════════════════════════════════════════
-- GAME SESSIONS
-- ═══════════════════════════════════════════════════════

-- Uživatel vidí pouze vlastní sessions
create policy "sessions: select own"
  on public.game_sessions for select
  using (auth.uid() = user_id);

-- Admin vidí vše
create policy "sessions: admin select all"
  on public.game_sessions for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Přihlášený uživatel může vkládat vlastní session
create policy "sessions: insert own"
  on public.game_sessions for insert
  with check (auth.uid() = user_id);

-- Uživatel může aktualizovat vlastní session (pro uložení výsledků)
create policy "sessions: update own"
  on public.game_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Mazání zakázáno pro všechny (audit trail)
-- Admin může mazat přes service_role v Edge Function
