-- HistoryGuessr · Migrace 031 · Skórovací jádro + pokusy o kampaň
--
-- ⚠️ DESTRUKTIVNÍ pro kampaně: tabulky z migrace 028 se zahodí a vytvoří znovu
--    dle zadání. Kampaně zatím nikdo nehrál, takže se neztrácí hráčská data.
--    (events/profiles/daily/multiplayer se NEDOTÝKÁME.)
--
-- Co přináší:
--   1) public.score_event_guess() — JEDINÉ místo s bodovacím vzorcem na serveru.
--      Multiplayer (014/025) měl vzorec zkopírovaný → sjednoceno, MP ho teď volá.
--   2) app_config — konfigurovatelné prahy hvězd a denní limit (jeden zdroj pravdy).
--   3) campaign_attempts + campaign_attempt_rounds — bezpečný průchod kampaní:
--      server počítá skóre, kola i dokončení jsou IDEMPOTENTNÍ, pokus lze obnovit.
--   4) Odemykání kampaní dle required_category_stars (NE sekvenčně).
--   5) Konfigurovatelný počet kol (rounds_count) — už ne natvrdo 5.
--
-- Spusť v Supabase SQL editoru. Idempotentní.

-- ═════════════════════════════════════════════════════════
-- 1) Konfigurace (jeden autoritativní zdroj)
-- ═════════════════════════════════════════════════════════
create table if not exists public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_config (key, value) values
  -- Relativní prahy z maxima (rounds_count × 1000).
  -- Pro 5 kol (max 5000) dávají přesně 2000 / 3250 / 4250 dle zadání.
  ('campaign_star_thresholds_pct', '[0.40, 0.65, 0.85]'::jsonb),
  ('free_expeditions_per_day',     '5'::jsonb),
  ('campaign_limit_enabled',       'true'::jsonb)
on conflict (key) do nothing;

alter table public.app_config enable row level security;
drop policy if exists "cfg: read all" on public.app_config;
create policy "cfg: read all" on public.app_config for select using (true);
drop policy if exists "cfg: admin write" on public.app_config;
create policy "cfg: admin write" on public.app_config for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
grant select on public.app_config to authenticated, anon;
grant insert, update, delete on public.app_config to authenticated;

-- ═════════════════════════════════════════════════════════
-- 2) SDÍLENÉ SKÓROVACÍ JÁDRO
--     Musí se shodovat se src/lib/scoring.ts:
--       poloha: 500 · e^(−max(0, km−radius)/1500)
--       rok:    500 v rozsahu, jinak 500 · e^(−roky_mimo/240)
-- ═════════════════════════════════════════════════════════
create or replace function public.score_event_guess(
  p_event_id   uuid,
  p_guess_lat  double precision,
  p_guess_lng  double precision,
  p_guess_year int
)
returns table (
  location_score int,
  year_score     int,
  round_score    int,
  distance_km    double precision,
  year_diff      int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lat double precision; v_lng double precision;
  v_yf int; v_yt int; v_radius double precision;
  v_a double precision; v_dist double precision; v_over double precision;
  v_loc int; v_year int; v_ydiff int;
begin
  select e.lat, e.lng,
         coalesce(e.year_from, e.year), coalesce(e.year_to, e.year),
         coalesce(e.location_radius_km, 0)
    into v_lat, v_lng, v_yf, v_yt, v_radius
    from public.events e
   where e.id = p_event_id;

  if v_lat is null then raise exception 'event_not_found'; end if;

  -- Chybějící tip = maximální penalizace (nedá se získat nic zadarmo)
  if p_guess_lat is null or p_guess_lng is null then
    v_dist := 20000;
  else
    v_a := sin(radians(p_guess_lat - v_lat)/2)^2
         + cos(radians(v_lat)) * cos(radians(p_guess_lat))
         * sin(radians(p_guess_lng - v_lng)/2)^2;
    v_dist := 6371 * 2 * atan2(sqrt(v_a), sqrt(1 - v_a));
  end if;

  v_over := greatest(0, v_dist - v_radius);
  v_loc := round(500 * exp(-v_over / 1500.0));

  if p_guess_year between v_yf and v_yt then
    v_year  := 500;
    v_ydiff := 0;
  else
    v_ydiff := case when p_guess_year < v_yf then v_yf - p_guess_year
                    else p_guess_year - v_yt end;
    v_year  := round(500 * exp(-v_ydiff / 240.0));
  end if;

  location_score := v_loc;
  year_score     := v_year;
  round_score    := v_loc + v_year;
  distance_km    := v_dist;
  year_diff      := v_ydiff;
  return next;
end;
$$;
grant execute on function public.score_event_guess(uuid, double precision, double precision, int) to authenticated;

-- Multiplayer teď používá sdílené jádro (konec kopírovaného vzorce z 014/025)
create or replace function public.submit_multiplayer_answer(
  p_room_id uuid,
  p_round_number int,
  p_guess_lat double precision,
  p_guess_lng double precision,
  p_guess_year int
)
returns table (location_score int, year_score int, round_score int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_event_id uuid;
  v_loc int; v_year int; v_total int;
  v_inserted int;
begin
  if v_uid is null or not exists (
    select 1 from public.multiplayer_players
     where room_id = p_room_id and user_id = v_uid
  ) then
    raise exception 'not a participant';
  end if;

  select r.event_id into v_event_id
    from public.multiplayer_rounds r
   where r.room_id = p_room_id and r.round_number = p_round_number;
  if v_event_id is null then raise exception 'round not found'; end if;

  select s.location_score, s.year_score, s.round_score
    into v_loc, v_year, v_total
    from public.score_event_guess(v_event_id, p_guess_lat, p_guess_lng, p_guess_year) s;

  insert into public.multiplayer_answers
    (room_id, round_number, user_id, guess_lat, guess_lng, guess_year,
     location_score, year_score, round_score)
  values
    (p_room_id, p_round_number, v_uid, p_guess_lat, p_guess_lng, p_guess_year,
     v_loc, v_year, v_total)
  on conflict (room_id, round_number, user_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    update public.multiplayer_players
       set total_score = coalesce(total_score, 0) + v_total
     where room_id = p_room_id and user_id = v_uid;
  end if;

  location_score := v_loc;
  year_score := v_year;
  round_score := v_total;
  return next;
end;
$$;
grant execute on function public.submit_multiplayer_answer(uuid, int, double precision, double precision, int) to authenticated;

-- ═════════════════════════════════════════════════════════
-- 3) Kampaně — destruktivní přestavba
-- ═════════════════════════════════════════════════════════
drop function if exists public.start_campaign_attempt(uuid);
drop function if exists public.submit_campaign_result(uuid, integer);

drop table if exists public.campaign_attempt_rounds cascade;
drop table if exists public.campaign_attempts       cascade;
drop table if exists public.user_campaign_progress  cascade;
drop table if exists public.campaign_events         cascade;
drop table if exists public.campaigns               cascade;
drop table if exists public.campaign_categories     cascade;

create table public.campaign_categories (
  id                   uuid primary key default gen_random_uuid(),
  seq                  integer not null default 0,
  slug                 text unique,
  title                text not null,
  title_en             text,
  title_de             text,
  description          text,
  description_en       text,
  description_de       text,
  icon                 text,
  color                text,
  hero_image_url       text,
  required_global_stars integer not null default 0 check (required_global_stars >= 0),
  is_premium           boolean not null default false,
  status               text not null default 'draft' check (status in ('draft','published','archived')),
  published_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.campaigns (
  id                     uuid primary key default gen_random_uuid(),
  category_id            uuid not null references public.campaign_categories(id) on delete cascade,
  seq                    integer not null default 0,
  slug                   text unique,
  title                  text not null,
  title_en               text,
  title_de               text,
  description            text,
  description_en         text,
  description_de         text,
  visual_url             text,
  rounds_count           integer not null default 5 check (rounds_count between 1 and 20),
  -- volitelné vlastní prahy ★ (jinak globální z app_config)
  star_thresholds_pct    jsonb,
  required_category_stars integer not null default 0 check (required_category_stars >= 0),
  is_premium             boolean not null default false,
  status                 text not null default 'draft' check (status in ('draft','published','archived')),
  published_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index idx_campaigns_category on public.campaigns(category_id);

create table public.campaign_events (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  position    integer not null check (position >= 1),   -- už NE natvrdo 1..5
  event_id    uuid not null references public.events(id) on delete restrict,
  is_active   boolean not null default true,
  admin_note  text,
  primary key (campaign_id, position),
  -- stejná událost nesmí být v jedné kampani dvakrát
  constraint uq_campaign_event unique (campaign_id, event_id)
);
create index idx_campaign_events_event on public.campaign_events(event_id);

create table public.user_campaign_progress (
  user_id           uuid not null references auth.users(id) on delete cascade,
  campaign_id       uuid not null references public.campaigns(id) on delete cascade,
  best_score        integer not null default 0,
  best_stars        integer not null default 0 check (best_stars between 0 and 3),
  completed_runs    integer not null default 0,
  attempts_count    integer not null default 0,
  first_completed_at timestamptz,
  last_played_at    timestamptz,
  primary key (user_id, campaign_id)
);

create table public.campaign_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  status       text not null default 'in_progress'
               check (status in ('created','in_progress','completed','abandoned','expired')),
  rounds_total integer not null,
  total_score  integer not null default 0,
  stars        integer not null default 0 check (stars between 0 and 3),
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  expires_at   timestamptz not null default now() + interval '24 hours'
);
create index idx_attempts_user_campaign on public.campaign_attempts(user_id, campaign_id);
-- Nejvýš JEDEN rozehraný pokus na (uživatel, kampaň) → bezpečné i s více kartami
create unique index uq_attempt_active
  on public.campaign_attempts(user_id, campaign_id) where status = 'in_progress';

create table public.campaign_attempt_rounds (
  attempt_id     uuid not null references public.campaign_attempts(id) on delete cascade,
  position       integer not null,
  event_id       uuid not null references public.events(id) on delete restrict,
  guess_lat      double precision,
  guess_lng      double precision,
  guess_year     integer,
  location_score integer,
  year_score     integer,
  round_score    integer,
  answered_at    timestamptz,
  primary key (attempt_id, position)
);

-- ═════════════════════════════════════════════════════════
-- 4) Pomocné funkce — hvězdy
-- ═════════════════════════════════════════════════════════
create or replace function public.campaign_stars_for_score(
  p_score int, p_rounds int, p_thresholds jsonb default null
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  with t as (
    select coalesce(
      p_thresholds,
      (select value from public.app_config where key = 'campaign_star_thresholds_pct'),
      '[0.40, 0.65, 0.85]'::jsonb
    ) as pct
  )
  select case
    when p_score >= round((p_rounds * 1000) * ((select pct->>2 from t)::numeric)) then 3
    when p_score >= round((p_rounds * 1000) * ((select pct->>1 from t)::numeric)) then 2
    when p_score >= round((p_rounds * 1000) * ((select pct->>0 from t)::numeric)) then 1
    else 0
  end
$$;
grant execute on function public.campaign_stars_for_score(int, int, jsonb) to authenticated;

create or replace function public.user_global_stars(p_user uuid default auth.uid())
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(best_stars), 0)::int from public.user_campaign_progress where user_id = p_user
$$;
grant execute on function public.user_global_stars(uuid) to authenticated;

create or replace function public.user_category_stars(p_category uuid, p_user uuid default auth.uid())
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(p.best_stars), 0)::int
    from public.user_campaign_progress p
    join public.campaigns c on c.id = p.campaign_id
   where p.user_id = p_user and c.category_id = p_category
$$;
grant execute on function public.user_category_stars(uuid, uuid) to authenticated;

-- ═════════════════════════════════════════════════════════
-- 5) RPC — start pokusu (autorizace + limit + idempotentní obnova)
-- ═════════════════════════════════════════════════════════
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
  v_energy    int; v_reset date;
  v_today     date := (now() at time zone 'utc')::date;  -- reset v UTC (rozhodnutí)
  v_free      int;
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

  -- Kampaň musí mít kompletní obsah
  if (select count(*) from public.campaign_events
       where campaign_id = p_campaign_id and is_active) <> v_rounds then
    raise exception 'campaign_incomplete';
  end if;

  -- ── Autorizace: hvězdy (Premium je NIKDY neobchází) ──
  if public.user_global_stars(v_uid) < v_req_glob then raise exception 'locked_global_stars'; end if;
  if public.user_category_stars(v_cat, v_uid) < v_req_cat then raise exception 'locked_category_stars'; end if;

  -- ── Autorizace: Premium obsah ──
  v_prem := public.is_premium(v_uid);
  if (v_cat_prem or v_camp_prem) and not v_prem then raise exception 'premium_required'; end if;

  -- ── Obnova rozehraného pokusu (nestojí další výpravu) ──
  select id into v_existing from public.campaign_attempts
   where user_id = v_uid and campaign_id = p_campaign_id and status = 'in_progress'
     and expires_at > now()
   limit 1;

  if v_existing is not null then
    select array_agg(event_id order by position) into v_events
      from public.campaign_attempt_rounds where attempt_id = v_existing;
    select coalesce(energy, 5) into v_energy from public.profiles where id = v_uid;
    return query select v_existing, v_rounds, coalesce(v_events, '{}'),
                        (case when v_prem then -1 else v_energy end), true;
    return;
  end if;

  -- Prošlé rozehrané pokusy ukliď
  update public.campaign_attempts set status = 'expired'
   where user_id = v_uid and status = 'in_progress' and expires_at <= now();

  -- ── Denní limit (výpravy) ──
  select coalesce((select (value#>>'{}')::int from public.app_config where key = 'free_expeditions_per_day'), 5),
         coalesce((select (value#>>'{}')::boolean from public.app_config where key = 'campaign_limit_enabled'), true)
    into v_free, v_limit_on;

  select coalesce(energy, v_free), energy_reset_at into v_energy, v_reset
    from public.profiles where id = v_uid;

  if v_reset is null or v_reset < v_today then
    v_energy := v_free; v_reset := v_today;
  end if;

  if v_limit_on and not v_prem then
    if v_energy <= 0 then raise exception 'no_energy'; end if;
    v_energy := v_energy - 1;
  end if;
  update public.profiles set energy = v_energy, energy_reset_at = v_reset where id = v_uid;

  -- ── Vytvoř pokus + zamraz pořadí událostí ──
  insert into public.campaign_attempts (user_id, campaign_id, status, rounds_total)
  values (v_uid, p_campaign_id, 'in_progress', v_rounds)
  returning id into v_attempt;

  insert into public.campaign_attempt_rounds (attempt_id, position, event_id)
  select v_attempt, ce.position, ce.event_id
    from public.campaign_events ce
   where ce.campaign_id = p_campaign_id and ce.is_active
   order by ce.position;

  update public.user_campaign_progress
     set attempts_count = attempts_count + 1, last_played_at = now()
   where user_id = v_uid and campaign_id = p_campaign_id;
  if not found then
    insert into public.user_campaign_progress (user_id, campaign_id, attempts_count, last_played_at)
    values (v_uid, p_campaign_id, 1, now())
    on conflict (user_id, campaign_id) do update
      set attempts_count = public.user_campaign_progress.attempts_count + 1, last_played_at = now();
  end if;

  select array_agg(event_id order by position) into v_events
    from public.campaign_attempt_rounds where attempt_id = v_attempt;

  return query select v_attempt, v_rounds, coalesce(v_events, '{}'),
                      (case when v_prem then -1 else v_energy end), false;
end;
$$;
grant execute on function public.start_campaign_attempt(uuid) to authenticated;

-- ═════════════════════════════════════════════════════════
-- 6) RPC — odeslání kola (server počítá skóre; IDEMPOTENTNÍ)
-- ═════════════════════════════════════════════════════════
create or replace function public.submit_campaign_round(
  p_attempt_id uuid,
  p_position   int,
  p_guess_lat  double precision,
  p_guess_lng  double precision,
  p_guess_year int
)
returns table (location_score int, year_score int, round_score int, distance_km double precision, year_diff int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_event uuid;
  v_answered timestamptz;
  v_loc int; v_year int; v_total int; v_dist double precision; v_yd int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select a.status into v_status from public.campaign_attempts a
   where a.id = p_attempt_id and a.user_id = v_uid;
  if v_status is null then raise exception 'attempt_not_found'; end if;
  if v_status <> 'in_progress' then raise exception 'attempt_not_active'; end if;

  select r.event_id, r.answered_at into v_event, v_answered
    from public.campaign_attempt_rounds r
   where r.attempt_id = p_attempt_id and r.position = p_position;
  if v_event is null then raise exception 'round_not_found'; end if;

  -- Idempotence: už zodpovězené kolo se NEPŘEPISUJE. Vrátíme uložené skóre
  -- a vzdálenost/rozdíl let dopočítáme z PŮVODNÍHO tipu (ne z nově poslaného).
  if v_answered is not null then
    return query
      select r.location_score, r.year_score, r.round_score, s.distance_km, s.year_diff
        from public.campaign_attempt_rounds r
        cross join lateral public.score_event_guess(r.event_id, r.guess_lat, r.guess_lng, r.guess_year) s
       where r.attempt_id = p_attempt_id and r.position = p_position;
    return;
  end if;

  select s.location_score, s.year_score, s.round_score, s.distance_km, s.year_diff
    into v_loc, v_year, v_total, v_dist, v_yd
    from public.score_event_guess(v_event, p_guess_lat, p_guess_lng, p_guess_year) s;

  update public.campaign_attempt_rounds
     set guess_lat = p_guess_lat, guess_lng = p_guess_lng, guess_year = p_guess_year,
         location_score = v_loc, year_score = v_year, round_score = v_total,
         answered_at = now()
   where attempt_id = p_attempt_id and position = p_position;

  location_score := v_loc; year_score := v_year; round_score := v_total;
  distance_km := v_dist; year_diff := v_yd;
  return next;
end;
$$;
grant execute on function public.submit_campaign_round(uuid, int, double precision, double precision, int) to authenticated;

-- ═════════════════════════════════════════════════════════
-- 7) RPC — dokončení pokusu (IDEMPOTENTNÍ, drží nejlepší)
-- ═════════════════════════════════════════════════════════
create or replace function public.complete_campaign_attempt(p_attempt_id uuid)
returns table (total_score int, stars int, best_score int, best_stars int, is_best boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text; v_campaign uuid; v_rounds int;
  v_answered int; v_total int; v_stars int;
  v_thr jsonb;
  v_prev_score int; v_prev_stars int;
  v_is_best boolean := false;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select a.status, a.campaign_id, a.rounds_total
    into v_status, v_campaign, v_rounds
    from public.campaign_attempts a
   where a.id = p_attempt_id and a.user_id = v_uid;
  if v_status is null then raise exception 'attempt_not_found'; end if;

  -- Idempotence: opakované dokončení vrátí uložený výsledek
  if v_status = 'completed' then
    return query
      select a.total_score, a.stars, p.best_score, p.best_stars, false
        from public.campaign_attempts a
        join public.user_campaign_progress p
          on p.user_id = v_uid and p.campaign_id = a.campaign_id
       where a.id = p_attempt_id;
    return;
  end if;
  if v_status <> 'in_progress' then raise exception 'attempt_not_active'; end if;

  -- Bez kompletních kol nelze dokončit (žádné hvězdy zadarmo)
  select count(*) into v_answered
    from public.campaign_attempt_rounds
   where attempt_id = p_attempt_id and answered_at is not null;
  if v_answered < v_rounds then raise exception 'rounds_incomplete'; end if;

  select coalesce(sum(round_score), 0) into v_total
    from public.campaign_attempt_rounds where attempt_id = p_attempt_id;

  select c.star_thresholds_pct into v_thr from public.campaigns c where c.id = v_campaign;
  v_stars := public.campaign_stars_for_score(v_total, v_rounds, v_thr);

  update public.campaign_attempts
     set status = 'completed', total_score = v_total, stars = v_stars, completed_at = now()
   where id = p_attempt_id;

  select p.best_score, p.best_stars into v_prev_score, v_prev_stars
    from public.user_campaign_progress p
   where p.user_id = v_uid and p.campaign_id = v_campaign;
  if v_prev_score is null or v_total > v_prev_score then v_is_best := true; end if;

  -- Zlepšit ANO, zhoršit NE
  insert into public.user_campaign_progress
    (user_id, campaign_id, best_score, best_stars, completed_runs, attempts_count, first_completed_at, last_played_at)
  values (v_uid, v_campaign, v_total, v_stars, 1, 1, now(), now())
  on conflict (user_id, campaign_id) do update set
    best_score        = greatest(public.user_campaign_progress.best_score, excluded.best_score),
    best_stars        = greatest(public.user_campaign_progress.best_stars, excluded.best_stars),
    completed_runs    = public.user_campaign_progress.completed_runs + 1,
    first_completed_at = coalesce(public.user_campaign_progress.first_completed_at, now()),
    last_played_at    = now();

  return query
    select v_total, v_stars, p.best_score, p.best_stars, v_is_best
      from public.user_campaign_progress p
     where p.user_id = v_uid and p.campaign_id = v_campaign;
end;
$$;
grant execute on function public.complete_campaign_attempt(uuid) to authenticated;

-- ═════════════════════════════════════════════════════════
-- 8) RLS + GRANTy
-- ═════════════════════════════════════════════════════════
alter table public.campaign_categories     enable row level security;
alter table public.campaigns                enable row level security;
alter table public.campaign_events          enable row level security;
alter table public.user_campaign_progress   enable row level security;
alter table public.campaign_attempts        enable row level security;
alter table public.campaign_attempt_rounds  enable row level security;

create policy "cat: read published" on public.campaign_categories for select
  using (status = 'published'
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "cat: admin write" on public.campaign_categories for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "camp: read published" on public.campaigns for select
  using (status = 'published'
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "camp: admin write" on public.campaigns for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "campev: read" on public.campaign_events for select
  using (exists (select 1 from public.campaigns c where c.id = campaign_id
                 and (c.status = 'published'
                      or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))));
create policy "campev: admin write" on public.campaign_events for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Postup a pokusy: hráč čte jen své; zápis VÝHRADNĚ přes RPC výše
create policy "ucp: select own" on public.user_campaign_progress for select
  using (auth.uid() = user_id);
create policy "att: select own" on public.campaign_attempts for select
  using (auth.uid() = user_id);
create policy "attr: select own" on public.campaign_attempt_rounds for select
  using (exists (select 1 from public.campaign_attempts a
                  where a.id = attempt_id and a.user_id = auth.uid()));

grant select, insert, update, delete
  on public.campaign_categories, public.campaigns, public.campaign_events to authenticated;
grant select
  on public.user_campaign_progress, public.campaign_attempts, public.campaign_attempt_rounds to authenticated;
grant select
  on public.campaign_categories, public.campaigns, public.campaign_events to anon;
