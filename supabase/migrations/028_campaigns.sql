-- HistoryGuessr · Migrace 028 · Kampaně (kategorie → kampaně → 5 událostí)
--
-- Model:
--   • campaign_categories — 10+ kategorií, odemykání za PEVNÝ počet ★ (unlock_stars).
--       Prahy jsou absolutní čísla (ne dopočítávané), aby přidávání obsahu nikdy
--       zpětně nezamklo hráči kategorii. ★ jen přibývají.
--   • campaigns — kampaň = kurátorská 5-tice událostí; sekvenční odemykání v rámci
--       kategorie (seq). Recykluje existující events.
--   • campaign_events — napojení kampaně na 5 published událostí (position 1..5).
--   • user_campaign_progress — nejlepší skóre + ★ (0–3) na (uživatel, kampaň).
--
-- Monetizace: denní energie. Free = 5 pokusů/den (reset v UTC půlnoci), premium = ∞.
--   Energii odečítá RPC start_campaign_attempt (server-authoritative).
--   ★ počítá RPC submit_campaign_result (thresholdy z 5000 b. za kampaň).
--
-- Spusť v Supabase SQL editoru. Idempotentní.

-- ─────────────────────────────────────────────────────────
-- 1) Rozšíření profiles o energii + premium
-- ─────────────────────────────────────────────────────────
alter table public.profiles add column if not exists is_premium      boolean not null default false;
alter table public.profiles add column if not exists energy          integer not null default 5;
alter table public.profiles add column if not exists energy_reset_at date;

-- ─────────────────────────────────────────────────────────
-- 2) Tabulky
-- ─────────────────────────────────────────────────────────
create table if not exists public.campaign_categories (
  id           uuid primary key default gen_random_uuid(),
  seq          integer not null default 0,
  slug         text unique,
  title        text not null,
  title_en     text,
  title_de     text,
  description  text,
  icon         text,           -- emoji / krátký kód ikony
  color        text,           -- akcentní barva (hex)
  unlock_stars integer not null default 0,   -- PEVNÝ globální práh ★
  is_premium   boolean not null default false,
  published    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.campaign_categories(id) on delete cascade,
  seq          integer not null default 0,
  title        text not null,
  title_en     text,
  title_de     text,
  description  text,
  unlock_stars integer not null default 0,   -- práh ★ v rámci kategorie (0 = první)
  published    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_campaigns_category on public.campaigns(category_id);

create table if not exists public.campaign_events (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  position    integer not null check (position between 1 and 5),
  event_id    uuid not null references public.events(id) on delete restrict,
  primary key (campaign_id, position)
);
create index if not exists idx_campaign_events_event on public.campaign_events(event_id);

create table if not exists public.user_campaign_progress (
  user_id       uuid not null references auth.users(id) on delete cascade,
  campaign_id   uuid not null references public.campaigns(id) on delete cascade,
  best_score    integer not null default 0,
  stars         integer not null default 0 check (stars between 0 and 3),
  attempts_used integer not null default 0,
  completed_at  timestamptz,
  primary key (user_id, campaign_id)
);

-- ─────────────────────────────────────────────────────────
-- 3) RLS
-- ─────────────────────────────────────────────────────────
alter table public.campaign_categories    enable row level security;
alter table public.campaigns               enable row level security;
alter table public.campaign_events         enable row level security;
alter table public.user_campaign_progress  enable row level security;

-- helper: je volající admin?
-- (inline exists, stejný vzor jako u events)

-- campaign_categories
drop policy if exists "cat: public select published" on public.campaign_categories;
create policy "cat: public select published" on public.campaign_categories for select
  using (published = true
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
drop policy if exists "cat: admin write" on public.campaign_categories;
create policy "cat: admin write" on public.campaign_categories for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- campaigns
drop policy if exists "camp: public select published" on public.campaigns;
create policy "camp: public select published" on public.campaigns for select
  using (published = true
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
drop policy if exists "camp: admin write" on public.campaigns;
create policy "camp: admin write" on public.campaigns for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- campaign_events
drop policy if exists "campev: public select" on public.campaign_events;
create policy "campev: public select" on public.campaign_events for select
  using (exists (select 1 from public.campaigns c where c.id = campaign_id
                 and (c.published = true
                      or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))));
drop policy if exists "campev: admin write" on public.campaign_events;
create policy "campev: admin write" on public.campaign_events for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- user_campaign_progress — vlastní read (zápis jde přes RPC security definer)
drop policy if exists "ucp: select own" on public.user_campaign_progress;
create policy "ucp: select own" on public.user_campaign_progress for select
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────
-- 4) RPC — start pokusu (odečet energie, vrátí 5 událostí)
--     energy_left = -1  → premium (neomezeně)
-- ─────────────────────────────────────────────────────────
create or replace function public.start_campaign_attempt(p_campaign_id uuid)
returns table(energy_left integer, event_ids uuid[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_prem   boolean;
  v_energy integer;
  v_reset  date;
  v_today  date := (now() at time zone 'utc')::date;
  v_events uuid[];
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.campaigns where id = p_campaign_id and published) then
    raise exception 'campaign_not_available';
  end if;

  select coalesce(is_premium, false), coalesce(energy, 5), energy_reset_at
    into v_prem, v_energy, v_reset
    from public.profiles where id = v_uid;

  -- líný denní reset
  if v_reset is null or v_reset < v_today then
    v_energy := 5;
    v_reset  := v_today;
  end if;

  if not v_prem then
    if v_energy <= 0 then raise exception 'no_energy'; end if;
    v_energy := v_energy - 1;
  end if;

  update public.profiles set energy = v_energy, energy_reset_at = v_reset where id = v_uid;

  select array_agg(event_id order by position) into v_events
    from public.campaign_events where campaign_id = p_campaign_id;

  return query select (case when v_prem then -1 else v_energy end), coalesce(v_events, '{}');
end;
$$;
grant execute on function public.start_campaign_attempt(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────
-- 5) RPC — odeslání výsledku kampaně (★ z 5000 b., drží nejlepší)
--     Thresholdy: 1★≥2000, 2★≥3250, 3★≥4250
-- ─────────────────────────────────────────────────────────
create or replace function public.submit_campaign_result(p_campaign_id uuid, p_total_score integer)
returns table(stars integer, best_score integer, is_best boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_stars   integer;
  v_prev    integer;
  v_is_best boolean := false;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.campaigns where id = p_campaign_id and published) then
    raise exception 'campaign_not_available';
  end if;

  v_stars := case
    when p_total_score >= 4250 then 3
    when p_total_score >= 3250 then 2
    when p_total_score >= 2000 then 1
    else 0 end;

  select ucp.best_score into v_prev
    from public.user_campaign_progress ucp
    where ucp.user_id = v_uid and ucp.campaign_id = p_campaign_id;
  if v_prev is null or p_total_score > v_prev then v_is_best := true; end if;

  insert into public.user_campaign_progress
    (user_id, campaign_id, best_score, stars, attempts_used, completed_at)
  values
    (v_uid, p_campaign_id, greatest(p_total_score, 0),
     v_stars, 1, now())
  on conflict (user_id, campaign_id) do update set
    best_score    = greatest(public.user_campaign_progress.best_score, excluded.best_score),
    stars         = greatest(public.user_campaign_progress.stars, excluded.stars),
    attempts_used = public.user_campaign_progress.attempts_used + 1,
    completed_at  = now();

  return query
    select ucp.stars, ucp.best_score, v_is_best
      from public.user_campaign_progress ucp
      where ucp.user_id = v_uid and ucp.campaign_id = p_campaign_id;
end;
$$;
grant execute on function public.submit_campaign_result(uuid, integer) to authenticated;
