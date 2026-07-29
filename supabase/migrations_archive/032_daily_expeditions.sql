-- HistoryGuessr · Migrace 032 · Denní výpravy (limit hraní kampaní)
--
-- Nahrazuje provizorní profiles.energy vlastní tabulkou:
--   user_daily_campaign_usage — spotřeba po dnech, včetně bonusů od admina
--
-- Pravidla (autorita = server):
--   • Free má N výprav denně (app_config: free_expeditions_per_day, výchozí 5)
--   • Premium = neomezeně
--   • limit lze globálně vypnout (app_config: campaign_limit_enabled)
--   • admin může konkrétnímu hráči přidat bonusové výpravy
--   • RESET: půlnoc UTC (rozhodnutí projektu — aplikace nezná TZ uživatele)
--   • výprava se odečte AŽ při skutečném vytvoření pokusu (ne při otevření detailu)
--   • obnovení rozehraného pokusu NEstojí další výpravu
--
-- Spusť v Supabase SQL editoru. Idempotentní. Vyžaduje migrace 030 a 031.

-- ─────────────────────────────────────────────────────────
-- 1) Tabulka spotřeby
-- ─────────────────────────────────────────────────────────
create table if not exists public.user_daily_campaign_usage (
  user_id     uuid not null references auth.users(id) on delete cascade,
  usage_date  date not null,                       -- UTC den
  used_count  integer not null default 0 check (used_count >= 0),
  bonus_count integer not null default 0 check (bonus_count >= 0),
  updated_at  timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.user_daily_campaign_usage enable row level security;
drop policy if exists "usage: select own" on public.user_daily_campaign_usage;
create policy "usage: select own" on public.user_daily_campaign_usage for select
  using (auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
-- Zápis VÝHRADNĚ přes SECURITY DEFINER funkce níže.
grant select on public.user_daily_campaign_usage to authenticated;

-- ─────────────────────────────────────────────────────────
-- 2) Pomocné funkce
-- ─────────────────────────────────────────────────────────
create or replace function public.config_int(p_key text, p_default int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select (value#>>'{}')::int from public.app_config where key = p_key), p_default)
$$;

create or replace function public.config_bool(p_key text, p_default boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value#>>'{}')::boolean from public.app_config where key = p_key), p_default)
$$;

/** Zbývající výpravy dnes. -1 = neomezeně (Premium nebo vypnutý limit). */
create or replace function public.remaining_expeditions(p_user uuid default auth.uid())
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_free int; v_used int; v_bonus int;
begin
  if p_user is null then return 0; end if;
  if public.is_premium(p_user) then return -1; end if;
  if not public.config_bool('campaign_limit_enabled', true) then return -1; end if;

  v_free := public.config_int('free_expeditions_per_day', 5);
  select used_count, bonus_count into v_used, v_bonus
    from public.user_daily_campaign_usage
   where user_id = p_user and usage_date = v_today;

  return greatest(0, (v_free + coalesce(v_bonus, 0)) - coalesce(v_used, 0));
end;
$$;
grant execute on function public.remaining_expeditions(uuid) to authenticated;

/** Přehled výprav pro UI. */
create or replace function public.get_my_expeditions()
returns table(remaining int, per_day int, used int, bonus int, is_premium boolean, resets_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
begin
  select coalesce(u.used_count, 0), coalesce(u.bonus_count, 0)
    into used, bonus
    from (select 1) x
    left join public.user_daily_campaign_usage u
      on u.user_id = v_uid and u.usage_date = v_today;

  remaining  := public.remaining_expeditions(v_uid);
  per_day    := public.config_int('free_expeditions_per_day', 5);
  is_premium := public.is_premium(v_uid);
  -- Reset: následující půlnoc UTC
  resets_at  := ((v_today + 1)::timestamp at time zone 'utc');
  return next;
end;
$$;
grant execute on function public.get_my_expeditions() to authenticated;

-- ─────────────────────────────────────────────────────────
-- 3) Admin — bonusové výpravy konkrétnímu hráči
-- ─────────────────────────────────────────────────────────
create or replace function public.admin_grant_expeditions(
  p_user uuid, p_count int, p_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := coalesce(p_date, (now() at time zone 'utc')::date);
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'forbidden';
  end if;
  if p_count < 0 then raise exception 'invalid_count'; end if;

  insert into public.user_daily_campaign_usage (user_id, usage_date, bonus_count)
  values (p_user, v_day, p_count)
  on conflict (user_id, usage_date) do update
    set bonus_count = public.user_daily_campaign_usage.bonus_count + excluded.bonus_count,
        updated_at = now();
end;
$$;
grant execute on function public.admin_grant_expeditions(uuid, int, date) to authenticated;

-- ─────────────────────────────────────────────────────────
-- 4) start_campaign_attempt — limit z nové tabulky
--     (jinak shodné s migrací 031)
-- ─────────────────────────────────────────────────────────
create or replace function public.start_campaign_attempt(p_campaign_id uuid)
returns table(attempt_id uuid, rounds_total int, event_ids uuid[], energy_left int, resumed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_cat       uuid;
  v_rounds    int;
  v_cat_prem  boolean; v_camp_prem boolean;
  v_req_glob  int; v_req_cat int;
  v_prem      boolean;
  v_today     date := (now() at time zone 'utc')::date;
  v_free      int; v_used int; v_bonus int; v_limit int;
  v_limit_on  boolean;
  v_existing  uuid;
  v_attempt   uuid;
  v_events    uuid[];
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select c.category_id, c.rounds_count, c.is_premium, c.required_category_stars,
         cat.is_premium, cat.required_global_stars
    into v_cat, v_rounds, v_camp_prem, v_req_cat, v_cat_prem, v_req_glob
    from public.campaigns c
    join public.campaign_categories cat on cat.id = c.category_id
   where c.id = p_campaign_id and c.status = 'published' and cat.status = 'published';
  if v_cat is null then raise exception 'campaign_not_available'; end if;

  if (select count(*) from public.campaign_events
       where campaign_id = p_campaign_id and is_active) <> v_rounds then
    raise exception 'campaign_incomplete';
  end if;

  -- Hvězdy (Premium je NIKDY neobchází)
  if public.user_global_stars(v_uid) < v_req_glob then raise exception 'locked_global_stars'; end if;
  if public.user_category_stars(v_cat, v_uid) < v_req_cat then raise exception 'locked_category_stars'; end if;

  -- Premium obsah
  v_prem := public.is_premium(v_uid);
  if (v_cat_prem or v_camp_prem) and not v_prem then raise exception 'premium_required'; end if;

  -- Obnova rozehraného pokusu — NEstojí další výpravu
  select id into v_existing from public.campaign_attempts
   where user_id = v_uid and campaign_id = p_campaign_id and status = 'in_progress'
     and expires_at > now()
   limit 1;
  if v_existing is not null then
    select array_agg(event_id order by position) into v_events
      from public.campaign_attempt_rounds where attempt_id = v_existing;
    return query select v_existing, v_rounds, coalesce(v_events, '{}'),
                        public.remaining_expeditions(v_uid), true;
    return;
  end if;

  update public.campaign_attempts set status = 'expired'
   where user_id = v_uid and status = 'in_progress' and expires_at <= now();

  -- ── Denní limit výprav ──
  v_limit_on := public.config_bool('campaign_limit_enabled', true);
  if v_limit_on and not v_prem then
    v_free := public.config_int('free_expeditions_per_day', 5);
    select used_count, bonus_count into v_used, v_bonus
      from public.user_daily_campaign_usage
     where user_id = v_uid and usage_date = v_today;
    v_used := coalesce(v_used, 0); v_bonus := coalesce(v_bonus, 0);
    v_limit := v_free + v_bonus;
    if v_used >= v_limit then raise exception 'no_energy'; end if;

    -- Výprava se odečte až TEĎ, při skutečném vytvoření pokusu
    insert into public.user_daily_campaign_usage (user_id, usage_date, used_count)
    values (v_uid, v_today, 1)
    on conflict (user_id, usage_date) do update
      set used_count = public.user_daily_campaign_usage.used_count + 1, updated_at = now();
  end if;

  insert into public.campaign_attempts (user_id, campaign_id, status, rounds_total)
  values (v_uid, p_campaign_id, 'in_progress', v_rounds)
  returning id into v_attempt;

  insert into public.campaign_attempt_rounds (attempt_id, position, event_id)
  select v_attempt, ce.position, ce.event_id
    from public.campaign_events ce
   where ce.campaign_id = p_campaign_id and ce.is_active
   order by ce.position;

  insert into public.user_campaign_progress (user_id, campaign_id, attempts_count, last_played_at)
  values (v_uid, p_campaign_id, 1, now())
  on conflict (user_id, campaign_id) do update
    set attempts_count = public.user_campaign_progress.attempts_count + 1, last_played_at = now();

  select array_agg(event_id order by position) into v_events
    from public.campaign_attempt_rounds where attempt_id = v_attempt;

  return query select v_attempt, v_rounds, coalesce(v_events, '{}'),
                      public.remaining_expeditions(v_uid), false;
end;
$$;
grant execute on function public.start_campaign_attempt(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────
-- 5) Úklid provizorních sloupců (nahrazeno 030 + touto migrací)
-- ─────────────────────────────────────────────────────────
alter table public.profiles drop column if exists energy;
alter table public.profiles drop column if exists energy_reset_at;
alter table public.profiles drop column if exists is_premium;
