-- HistoryGuessr · Migrace 006 · RLS pro multiplayer / daily / analytics
-- Tyto tabulky vznikly mimo migrace (v dashboardu) a NEMĚLY RLS,
-- takže s veřejným anon klíčem šlo číst i přepisovat cizí data.
-- Migrace je idempotentní (drop policy if exists) — lze spustit i na živé DB.
--
-- Spusť v Supabase SQL editoru.

-- ═══════════════════════════════════════════════════════
-- Pomocná funkce: je aktuální uživatel admin?
-- (SECURITY DEFINER + stabilní — zabraňuje rekurzi v politikách)
-- ═══════════════════════════════════════════════════════
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ═══════════════════════════════════════════════════════
-- MULTIPLAYER ROOMS
-- ═══════════════════════════════════════════════════════
alter table public.multiplayer_rooms enable row level security;

drop policy if exists "rooms: select authenticated" on public.multiplayer_rooms;
create policy "rooms: select authenticated"
  on public.multiplayer_rooms for select
  using (auth.uid() is not null);

drop policy if exists "rooms: insert as host" on public.multiplayer_rooms;
create policy "rooms: insert as host"
  on public.multiplayer_rooms for insert
  with check (auth.uid() = host_id);

drop policy if exists "rooms: host update" on public.multiplayer_rooms;
create policy "rooms: host update"
  on public.multiplayer_rooms for update
  using (auth.uid() = host_id)
  with check (auth.uid() = host_id);

drop policy if exists "rooms: host delete" on public.multiplayer_rooms;
create policy "rooms: host delete"
  on public.multiplayer_rooms for delete
  using (auth.uid() = host_id);

-- ═══════════════════════════════════════════════════════
-- MULTIPLAYER PLAYERS
-- (select povolen všem přihlášeným — jen username + skóre v efemérní místnosti;
--  zápis pouze do vlastního řádku, ať nelze falšovat cizí skóre)
-- ═══════════════════════════════════════════════════════
alter table public.multiplayer_players enable row level security;

drop policy if exists "players: select authenticated" on public.multiplayer_players;
create policy "players: select authenticated"
  on public.multiplayer_players for select
  using (auth.uid() is not null);

drop policy if exists "players: insert own" on public.multiplayer_players;
create policy "players: insert own"
  on public.multiplayer_players for insert
  with check (auth.uid() = user_id);

drop policy if exists "players: update own" on public.multiplayer_players;
create policy "players: update own"
  on public.multiplayer_players for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Host smí spravovat hráče své místnosti (kick / úklid)
drop policy if exists "players: host manage" on public.multiplayer_players;
create policy "players: host manage"
  on public.multiplayer_players for all
  using (
    exists (select 1 from public.multiplayer_rooms r
            where r.id = room_id and r.host_id = auth.uid())
  )
  with check (
    exists (select 1 from public.multiplayer_rooms r
            where r.id = room_id and r.host_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════
-- MULTIPLAYER ROUNDS
-- (čte kdokoli přihlášený; zapisuje pouze host místnosti)
-- ═══════════════════════════════════════════════════════
alter table public.multiplayer_rounds enable row level security;

drop policy if exists "rounds: select authenticated" on public.multiplayer_rounds;
create policy "rounds: select authenticated"
  on public.multiplayer_rounds for select
  using (auth.uid() is not null);

drop policy if exists "rounds: host write" on public.multiplayer_rounds;
create policy "rounds: host write"
  on public.multiplayer_rounds for all
  using (
    exists (select 1 from public.multiplayer_rooms r
            where r.id = room_id and r.host_id = auth.uid())
  )
  with check (
    exists (select 1 from public.multiplayer_rooms r
            where r.id = room_id and r.host_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════
-- MULTIPLAYER ANSWERS
-- (čte kdokoli přihlášený kvůli žebříčku kola; zapisuje jen vlastní odpověď)
-- ═══════════════════════════════════════════════════════
alter table public.multiplayer_answers enable row level security;

drop policy if exists "answers: select authenticated" on public.multiplayer_answers;
create policy "answers: select authenticated"
  on public.multiplayer_answers for select
  using (auth.uid() is not null);

drop policy if exists "answers: insert own" on public.multiplayer_answers;
create policy "answers: insert own"
  on public.multiplayer_answers for insert
  with check (auth.uid() = user_id);

drop policy if exists "answers: update own" on public.multiplayer_answers;
create policy "answers: update own"
  on public.multiplayer_answers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════
-- DAILY CHALLENGE ASSIGNMENTS (kalendář denních výzev)
-- (veřejné čtení; zápis jen admin)
-- ═══════════════════════════════════════════════════════
alter table public.daily_challenge_assignments enable row level security;

drop policy if exists "daily_assign: public select" on public.daily_challenge_assignments;
create policy "daily_assign: public select"
  on public.daily_challenge_assignments for select
  using (true);

drop policy if exists "daily_assign: admin write" on public.daily_challenge_assignments;
create policy "daily_assign: admin write"
  on public.daily_challenge_assignments for all
  using (public.is_admin())
  with check (public.is_admin());

-- ═══════════════════════════════════════════════════════
-- DAILY RESULTS (leaderboard denní výzvy)
-- (čtení všem kvůli žebříčku/histogramu; zápis jen vlastní)
-- ═══════════════════════════════════════════════════════
alter table public.daily_results enable row level security;

drop policy if exists "daily_results: public select" on public.daily_results;
create policy "daily_results: public select"
  on public.daily_results for select
  using (true);

drop policy if exists "daily_results: insert own" on public.daily_results;
create policy "daily_results: insert own"
  on public.daily_results for insert
  with check (auth.uid() = user_id);

-- Záměrně BEZ update/delete politik → 1 pokus za den nelze přepsat.

-- ═══════════════════════════════════════════════════════
-- ANALYTICS EVENTS
-- (přihlášený smí zapsat vlastní událost; číst jen admin)
-- ═══════════════════════════════════════════════════════
alter table public.analytics_events enable row level security;

drop policy if exists "analytics: insert own" on public.analytics_events;
create policy "analytics: insert own"
  on public.analytics_events for insert
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "analytics: admin select" on public.analytics_events;
create policy "analytics: admin select"
  on public.analytics_events for select
  using (public.is_admin());

-- ═══════════════════════════════════════════════════════
-- RPC: atomický inkrement skóre hráče v multiplayeru
-- (řeší TODO z CLAUDE.md — fallback v klientu je jen pojistka)
-- ═══════════════════════════════════════════════════════
create or replace function public.increment_multiplayer_score(
  p_room_id uuid,
  p_user_id uuid,
  p_score int
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.multiplayer_players
  set total_score = coalesce(total_score, 0) + p_score
  where room_id = p_room_id and user_id = p_user_id;
$$;
