-- HistoryGuessr · Roadmap / „podílej se na vývoji"
--
-- Předplatitelé (Premium) mohou navrhovat nápady a hlasovat pro vylepšení.
-- Položky spravuje admin. Free hráči seznam vidí (jako lákadlo), ale nehlasují.
--
-- Idempotentní. Testuj lokálně `supabase db reset`, pak spusť na produkci.

create table if not exists public.roadmap_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  status      text not null default 'planned' check (status in ('idea','planned','in_progress','done')),
  sort        int  not null default 0,
  created_by  uuid references auth.users(id) on delete set null,  -- kdo navrhl (null = admin)
  created_at  timestamptz not null default now()
);

create table if not exists public.roadmap_votes (
  item_id    uuid not null references public.roadmap_items(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

create index if not exists idx_roadmap_votes_item on public.roadmap_votes(item_id);

alter table public.roadmap_items enable row level security;
alter table public.roadmap_votes enable row level security;

-- ── RLS ───────────────────────────────────────────────────
-- Položky: čte kdokoli přihlášený; spravuje jen admin.
drop policy if exists roadmap_items_read  on public.roadmap_items;
drop policy if exists roadmap_items_admin on public.roadmap_items;
create policy roadmap_items_read  on public.roadmap_items for select to authenticated using (true);
create policy roadmap_items_admin on public.roadmap_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Hlasy: čte kdokoli (pro počty); vkládá jen Premium na svůj účet; maže svůj hlas.
drop policy if exists roadmap_votes_read on public.roadmap_votes;
drop policy if exists roadmap_votes_ins  on public.roadmap_votes;
drop policy if exists roadmap_votes_del  on public.roadmap_votes;
create policy roadmap_votes_read on public.roadmap_votes for select to authenticated using (true);
create policy roadmap_votes_ins  on public.roadmap_votes for insert to authenticated
  with check (user_id = auth.uid() and public.is_premium(auth.uid()));
create policy roadmap_votes_del  on public.roadmap_votes for delete to authenticated
  using (user_id = auth.uid());

-- ── RPC: seznam s počty hlasů + zda uživatel hlasoval ─────
create or replace function public.roadmap_list()
returns table(id uuid, title text, description text, status text, sort int, votes bigint, voted boolean, mine boolean)
language sql stable security definer set search_path = public as $$
  select i.id, i.title, i.description, i.status, i.sort,
    (select count(*) from public.roadmap_votes v where v.item_id = i.id) as votes,
    exists(select 1 from public.roadmap_votes v where v.item_id = i.id and v.user_id = auth.uid()) as voted,
    i.created_by = auth.uid() as mine
  from public.roadmap_items i
  order by
    case i.status when 'in_progress' then 0 when 'planned' then 1 when 'idea' then 2 else 3 end,
    i.sort asc,
    (select count(*) from public.roadmap_votes v where v.item_id = i.id) desc,
    i.created_at desc;
$$;
grant execute on function public.roadmap_list() to authenticated;

-- ── RPC: přepnutí hlasu (jen Premium) ─────────────────────
create or replace function public.roadmap_toggle_vote(p_item uuid)
returns boolean  -- nový stav (true = hlasováno)
language plpgsql security definer set search_path = public as $$
declare has_v boolean;
begin
  if not public.is_premium(auth.uid()) then raise exception 'premium_required'; end if;
  select exists(select 1 from public.roadmap_votes where item_id = p_item and user_id = auth.uid()) into has_v;
  if has_v then
    delete from public.roadmap_votes where item_id = p_item and user_id = auth.uid();
    return false;
  end if;
  insert into public.roadmap_votes(item_id, user_id) values (p_item, auth.uid()) on conflict do nothing;
  return true;
end; $$;
grant execute on function public.roadmap_toggle_vote(uuid) to authenticated;

-- ── RPC: návrh nápadu (jen Premium) → status 'idea' ───────
create or replace function public.roadmap_suggest(p_title text, p_description text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_premium(auth.uid()) then raise exception 'premium_required'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'empty_title'; end if;
  insert into public.roadmap_items(title, description, status, created_by)
    values (left(trim(p_title), 120), nullif(left(trim(p_description), 500), ''), 'idea', auth.uid())
    returning id into new_id;
  return new_id;
end; $$;
grant execute on function public.roadmap_suggest(text, text) to authenticated;
