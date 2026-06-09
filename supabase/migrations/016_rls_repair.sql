-- HistoryGuessr · Migrace 016 · Oprava RLS (403 při zakládání události)
--
-- Vkládání/úpravy událostí selhávalo na RLS (403), protože původní politiky
-- ověřovaly admina poddotazem do `profiles`, který sám podléhá RLS.
-- Přepíšeme je na SECURITY DEFINER funkci public.is_admin(), která RLS obchází.
-- Zároveň znovu pojistíme veřejné čtení daily_results (403 na denní výzvě).
--
-- Spusť v Supabase SQL editoru. Idempotentní.

-- ── is_admin() (z migrace 006, pro jistotu znovu) ─────────
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

-- ── EVENTS ────────────────────────────────────────────────
alter table public.events enable row level security;

drop policy if exists "events: public select published" on public.events;
create policy "events: public select published"
  on public.events for select
  using (published = true);

drop policy if exists "events: admin select all" on public.events;
create policy "events: admin select all"
  on public.events for select
  using (public.is_admin());

drop policy if exists "events: admin insert" on public.events;
create policy "events: admin insert"
  on public.events for insert
  with check (public.is_admin());

drop policy if exists "events: admin update" on public.events;
create policy "events: admin update"
  on public.events for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "events: admin delete" on public.events;
create policy "events: admin delete"
  on public.events for delete
  using (public.is_admin());

-- ── DAILY RESULTS (403 na denní výzvě) ────────────────────
alter table public.daily_results enable row level security;

drop policy if exists "daily_results: public select" on public.daily_results;
create policy "daily_results: public select"
  on public.daily_results for select
  using (true);

drop policy if exists "daily_results: insert own" on public.daily_results;
create policy "daily_results: insert own"
  on public.daily_results for insert
  with check (auth.uid() = user_id);
