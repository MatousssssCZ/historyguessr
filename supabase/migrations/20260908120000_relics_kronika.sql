-- ═══════════════════════════════════════════════════════════════════════
-- Kronika & relikvie (handoff 32a–32e)
-- Relikvie se udělují za dokončení kampaně: 3★ = zachovalá, plný počet bodů
-- = dokonalá. Žádné rarity, žádný herní bonus — sběratelská hodnota.
-- Idempotentní: lze spustit opakovaně.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Sady relikvií (spojují relikvie z více kampaní, odměna = titul) ──────
create table if not exists public.relic_sets (
  id           text primary key,               -- slug, např. 'pad-imperii'
  name         text not null,
  reward_type  text not null default 'title',  -- title | cosmetic (nikdy herní bonus)
  reward_id    text,
  reward_name  text,
  seq          integer not null default 0,
  created_at   timestamptz not null default now()
);

-- ── Relikvie (1:1 na kampaň) ────────────────────────────────────────────
create table if not exists public.relics (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,          -- pro import, např. 'caesaruv-denar'
  campaign_id    uuid unique references public.campaigns(id) on delete set null,
  set_id         text references public.relic_sets(id) on delete set null,
  name           text not null,
  year_label     text,                          -- '44 př. n. l.' (volný text, i BC)
  category       text,                          -- kopie kategorie kampaně (filtr ve vitríně)
  secret         boolean not null default false,-- true = do dokončení jen silueta
  description    text,                           -- 60–90 slov
  preserved_url  text,
  perfect_url    text,
  silhouette_url text,
  seq            integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists relics_campaign_idx on public.relics(campaign_id);
create index if not exists relics_category_idx on public.relics(category);
create index if not exists relics_set_idx on public.relics(set_id);

-- ── Vlastnictví relikvie hráčem ─────────────────────────────────────────
create table if not exists public.player_relics (
  user_id      uuid not null references auth.users(id) on delete cascade,
  relic_id     uuid not null references public.relics(id) on delete cascade,
  state        text not null default 'preserved' check (state in ('preserved','perfect')),
  acquired_at  timestamptz not null default now(),
  showcased    boolean not null default false,
  primary key (user_id, relic_id)
);
create index if not exists player_relics_user_idx on public.player_relics(user_id);
create index if not exists player_relics_relic_idx on public.player_relics(relic_id);

-- ── Podíl vlastníků (motivační jádro, i u skrytých) ─────────────────────
create or replace view public.relic_ownership as
select
  r.id as relic_id,
  count(distinct pr.user_id) as owners,
  round(
    count(distinct pr.user_id)::numeric
    / nullif((select count(*) from public.profiles), 0) * 100
  , 1) as owned_pct
from public.relics r
left join public.player_relics pr on pr.relic_id = r.id
group by r.id;

-- ── Udělení / upgrade relikvie při zlepšení postupu v kampani ───────────
-- 3★ → zachovalá; plný počet bodů (rounds_count × 1000) → dokonalá.
-- Jeden předmět se povyšuje, nikdy nedegraduje.
create or replace function public.grant_relic_on_progress()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_relic uuid;
  v_max   integer;
  v_state text;
begin
  if new.best_stars < 3 then return new; end if;

  select r.id into v_relic from public.relics r where r.campaign_id = new.campaign_id;
  if v_relic is null then return new; end if;

  select rounds_count * 1000 into v_max from public.campaigns where id = new.campaign_id;
  v_state := case when new.best_score >= v_max then 'perfect' else 'preserved' end;

  insert into public.player_relics (user_id, relic_id, state, acquired_at)
    values (new.user_id, v_relic, v_state, now())
  on conflict (user_id, relic_id) do update
    set state = case when excluded.state = 'perfect' then 'perfect' else public.player_relics.state end;

  return new;
end;
$$;

drop trigger if exists trg_grant_relic on public.user_campaign_progress;
create trigger trg_grant_relic
  after insert or update of best_stars, best_score on public.user_campaign_progress
  for each row execute function public.grant_relic_on_progress();

-- ── Vystavení: nejvýše 3 relikvie ───────────────────────────────────────
create or replace function public.enforce_showcase_limit()
  returns trigger
  language plpgsql
  set search_path to 'public'
as $$
begin
  if new.showcased and not coalesce(old.showcased, false) then
    if (select count(*) from public.player_relics
        where user_id = new.user_id and showcased) >= 3 then
      raise exception 'showcase_limit' using message = 'Vystavit lze nejvýše 3 relikvie.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_showcase_limit on public.player_relics;
create trigger trg_showcase_limit
  before update of showcased on public.player_relics
  for each row execute function public.enforce_showcase_limit();

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table public.relics       enable row level security;
alter table public.relic_sets   enable row level security;
alter table public.player_relics enable row level security;

-- Relikvie a sady: čtení pro všechny (i host), zápis jen admin
drop policy if exists relics_read on public.relics;
create policy relics_read on public.relics for select using (true);
drop policy if exists relics_admin_write on public.relics;
create policy relics_admin_write on public.relics for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists relic_sets_read on public.relic_sets;
create policy relic_sets_read on public.relic_sets for select using (true);
drop policy if exists relic_sets_admin_write on public.relic_sets;
create policy relic_sets_admin_write on public.relic_sets for all
  using (public.is_admin()) with check (public.is_admin());

-- Vlastnictví: hráč čte VŠE (kvůli podílu vlastníků přes view), ale zápis jen
-- do vlastních řádků a jen sloupce showcased (stav udílí trigger/definer).
drop policy if exists player_relics_read on public.player_relics;
create policy player_relics_read on public.player_relics for select using (true);
drop policy if exists player_relics_update_own on public.player_relics;
create policy player_relics_update_own on public.player_relics for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.relics, public.relic_sets, public.player_relics, public.relic_ownership to anon, authenticated;
grant update (showcased) on public.player_relics to authenticated;

-- ── Storage bucket pro rendery relikvií (veřejné čtení) ─────────────────
insert into storage.buckets (id, name, public)
  values ('relics', 'relics', true)
  on conflict (id) do nothing;

drop policy if exists relics_bucket_read on storage.objects;
create policy relics_bucket_read on storage.objects for select
  using (bucket_id = 'relics');
drop policy if exists relics_bucket_admin_write on storage.objects;
create policy relics_bucket_admin_write on storage.objects for all
  using (bucket_id = 'relics' and public.is_admin())
  with check (bucket_id = 'relics' and public.is_admin());
