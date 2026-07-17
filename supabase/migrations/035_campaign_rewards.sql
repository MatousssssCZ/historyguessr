-- HistoryGuessr · Migrace 035 · Sběratelské odměny (artefakty) za kampaně
--
-- Zadání (bod 15): kampaň může mít odměnu za první dokončení / 1★ / 3★.
--
-- Klíčové pravidlo: odměna je vázaná na KAMPAŇ a POČET HVĚZD — je stejná pro
-- Free i Premium. Premium účet nesmí za tutéž Free kampaň dostat lepší artefakt;
-- Premium artefakt může existovat jen u Premium obsahu (což plyne z toho, že
-- odměna patří ke konkrétní kampani).
--
-- Uděluje se podle NEJLEPŠÍHO výsledku (best_stars), takže zlepšením v opakování
-- lze artefakt doplnit. Jednou získaný se nikdy neztrácí (idempotentní insert).
--
-- Spusť v Supabase SQL editoru. Idempotentní. Vyžaduje migrace 031–034.

-- ─────────────────────────────────────────────────────────
-- 1) Tabulky
-- ─────────────────────────────────────────────────────────
create table if not exists public.campaign_rewards (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.campaigns(id) on delete cascade,
  kind           text not null default 'artifact' check (kind in ('artifact','badge','title')),
  -- 0 = za první dokončení, jinak počet ★ nutných k získání
  required_stars integer not null default 0 check (required_stars between 0 and 3),
  name           text not null,
  name_en        text,
  name_de        text,
  description    text,
  description_en text,
  description_de text,
  icon_url       text,
  rarity         text not null default 'common' check (rarity in ('common','rare','epic','legendary')),
  created_at     timestamptz not null default now(),
  -- jedna odměna na kampaň a úroveň
  constraint uq_reward_campaign_stars unique (campaign_id, required_stars)
);
create index if not exists idx_campaign_rewards_campaign on public.campaign_rewards(campaign_id);

create table if not exists public.user_campaign_rewards (
  user_id    uuid not null references auth.users(id) on delete cascade,
  reward_id  uuid not null references public.campaign_rewards(id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (user_id, reward_id)
);

-- ─────────────────────────────────────────────────────────
-- 2) RLS + granty
-- ─────────────────────────────────────────────────────────
alter table public.campaign_rewards      enable row level security;
alter table public.user_campaign_rewards enable row level security;

drop policy if exists "rew: read" on public.campaign_rewards;
create policy "rew: read" on public.campaign_rewards for select
  using (exists (select 1 from public.campaigns c where c.id = campaign_id
                 and (c.status = 'published'
                      or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))));
drop policy if exists "rew: admin write" on public.campaign_rewards;
create policy "rew: admin write" on public.campaign_rewards for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Vlastní odměny čte hráč; zápis jen serverem (při dokončení kampaně)
drop policy if exists "urew: select own" on public.user_campaign_rewards;
create policy "urew: select own" on public.user_campaign_rewards for select
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.campaign_rewards to authenticated;
grant select on public.user_campaign_rewards to authenticated;
grant select on public.campaign_rewards to anon;

-- ─────────────────────────────────────────────────────────
-- 3) Udělení odměn dle nejlepších ★ (idempotentní)
--     Vrací JEN nově získané, aby je UI mohlo oslavit.
-- ─────────────────────────────────────────────────────────
create or replace function public.grant_campaign_rewards(p_user uuid, p_campaign uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_best int;
  v_new jsonb;
begin
  select coalesce(best_stars, 0) into v_best
    from public.user_campaign_progress
   where user_id = p_user and campaign_id = p_campaign;
  if v_best is null then return '[]'::jsonb; end if;

  with granted as (
    insert into public.user_campaign_rewards (user_id, reward_id)
    select p_user, r.id
      from public.campaign_rewards r
     where r.campaign_id = p_campaign
       and r.required_stars <= v_best
    on conflict (user_id, reward_id) do nothing
    returning reward_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'kind', r.kind, 'rarity', r.rarity,
      'name', r.name, 'name_en', r.name_en, 'name_de', r.name_de,
      'description', r.description, 'description_en', r.description_en, 'description_de', r.description_de,
      'icon_url', r.icon_url, 'required_stars', r.required_stars
    )), '[]'::jsonb)
    into v_new
    from granted g join public.campaign_rewards r on r.id = g.reward_id;

  return coalesce(v_new, '[]'::jsonb);
end;
$$;

-- ─────────────────────────────────────────────────────────
-- 4) complete_campaign_attempt — nově uděluje i odměny
--     (jinak shodné s migrací 031)
--
-- POZOR: přibývá návratový sloupec new_rewards → mění se návratový typ.
-- `create or replace` to neumí ("cannot change return type of existing
-- function"), takže funkci nejdřív zahodíme. Nic na ní nezávisí (volá ji
-- jen klient přes RPC), takže je to bezpečné.
-- ─────────────────────────────────────────────────────────
drop function if exists public.complete_campaign_attempt(uuid);

create or replace function public.complete_campaign_attempt(p_attempt_id uuid)
returns table (total_score int, stars int, best_score int, best_stars int, is_best boolean, new_rewards jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text; v_campaign uuid; v_rounds int;
  v_answered int; v_total int; v_stars int;
  v_thr jsonb;
  v_prev_score int;
  v_is_best boolean := false;
  v_rewards jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select a.status, a.campaign_id, a.rounds_total
    into v_status, v_campaign, v_rounds
    from public.campaign_attempts a
   where a.id = p_attempt_id and a.user_id = v_uid;
  if v_status is null then raise exception 'attempt_not_found'; end if;

  -- Idempotence: opakované dokončení vrátí uložený výsledek (bez nových odměn)
  if v_status = 'completed' then
    return query
      select a.total_score, a.stars, p.best_score, p.best_stars, false, '[]'::jsonb
        from public.campaign_attempts a
        join public.user_campaign_progress p
          on p.user_id = v_uid and p.campaign_id = a.campaign_id
       where a.id = p_attempt_id;
    return;
  end if;
  if v_status <> 'in_progress' then raise exception 'attempt_not_active'; end if;

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

  select p.best_score into v_prev_score
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

  -- Odměny dle NEJLEPŠÍCH ★ (zlepšením lze artefakt doplnit)
  v_rewards := public.grant_campaign_rewards(v_uid, v_campaign);

  return query
    select v_total, v_stars, p.best_score, p.best_stars, v_is_best, v_rewards
      from public.user_campaign_progress p
     where p.user_id = v_uid and p.campaign_id = v_campaign;
end;
$$;
grant execute on function public.complete_campaign_attempt(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────
-- 5) Moje odměny (pro profil / sbírku)
-- ─────────────────────────────────────────────────────────
create or replace function public.get_my_rewards()
returns table (
  id uuid, campaign_id uuid, kind text, rarity text, required_stars int,
  name text, name_en text, name_de text,
  description text, description_en text, description_de text,
  icon_url text, granted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.campaign_id, r.kind, r.rarity, r.required_stars,
         r.name, r.name_en, r.name_de,
         r.description, r.description_en, r.description_de,
         r.icon_url, ur.granted_at
    from public.user_campaign_rewards ur
    join public.campaign_rewards r on r.id = ur.reward_id
   where ur.user_id = auth.uid()
   order by ur.granted_at desc
$$;
grant execute on function public.get_my_rewards() to authenticated;
