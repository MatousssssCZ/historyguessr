-- HistoryGuessr · Migrace 030 · Entitlementy (Free / Premium)
--
-- Centrální vrstva práv. Nahrazuje jednoduchý příznak profiles.is_premium.
--
--   • subscriptions      — zdroj pravdy o nákupu/udělení (historie, i vypršelé)
--   • user_entitlements  — materializovaná práva pro rychlé čtení (1 řádek/uživatel)
--   • entitlement_audit  — auditovatelné změny (kdo, kdy, co)
--
-- Autorita je VÝHRADNĚ server: klient nesmí zapisovat do user_entitlements.
-- Zápis jde jen přes SECURITY DEFINER funkce, které ověří roli admina.
--
-- Časově omezené Premium: is_premium=true + premium_until=<datum>.
-- Trvalé Premium:         is_premium=true + premium_until=null.
--
-- Spusť v Supabase SQL editoru. Idempotentní.

-- ─────────────────────────────────────────────────────────
-- 1) Tabulky
-- ─────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  plan         text not null default 'premium',
  status       text not null default 'active' check (status in ('active','canceled','expired')),
  source       text not null default 'manual' check (source in ('manual','admin','promo','stripe','apple','google')),
  started_at   timestamptz not null default now(),
  expires_at   timestamptz,             -- null = bez expirace
  external_ref text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_subscriptions_user on public.subscriptions(user_id);

create table if not exists public.user_entitlements (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  is_premium    boolean not null default false,
  premium_until timestamptz,            -- null + is_premium => trvalé
  source        text,
  granted_by    uuid references auth.users(id),
  reason        text,
  updated_at    timestamptz not null default now()
);

create table if not exists public.entitlement_audit (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  action     text not null,
  actor_id   uuid,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_entitlement_audit_user on public.entitlement_audit(user_id, created_at desc);

-- ─────────────────────────────────────────────────────────
-- 2) Migrace dat ze starého profiles.is_premium
-- ─────────────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_premium'
  ) then
    insert into public.user_entitlements (user_id, is_premium, premium_until, source, reason)
    select p.id, true, null, 'manual', 'migrace z profiles.is_premium (030)'
    from public.profiles p
    where coalesce(p.is_premium, false) = true
    on conflict (user_id) do nothing;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────
-- 3) Autoritativní kontrola Premium (respektuje expiraci)
--     Používej ji ve VŠECH serverových kontrolách.
-- ─────────────────────────────────────────────────────────
create or replace function public.is_premium(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select e.is_premium and (e.premium_until is null or e.premium_until > now())
    from public.user_entitlements e
    where e.user_id = p_user
  ), false)
$$;
grant execute on function public.is_premium(uuid) to authenticated;

-- Vlastní práva pro klienta (jediné, co potřebuje UI)
create or replace function public.get_my_entitlements()
returns table(is_premium boolean, premium_until timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_premium(auth.uid()) as is_premium,
    (select e.premium_until from public.user_entitlements e where e.user_id = auth.uid()) as premium_until
$$;
grant execute on function public.get_my_entitlements() to authenticated;

-- ─────────────────────────────────────────────────────────
-- 4) Administrace práv (jen admin, s auditem)
-- ─────────────────────────────────────────────────────────
create or replace function public.admin_set_premium(
  p_user uuid,
  p_is_premium boolean,
  p_until timestamptz default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor  uuid := auth.uid();
  v_before jsonb;
  v_after  jsonb;
begin
  if not exists (select 1 from public.profiles where id = v_actor and role = 'admin') then
    raise exception 'forbidden';
  end if;

  select to_jsonb(e) into v_before from public.user_entitlements e where e.user_id = p_user;

  insert into public.user_entitlements (user_id, is_premium, premium_until, source, granted_by, reason, updated_at)
  values (p_user, p_is_premium, p_until, 'admin', v_actor, p_reason, now())
  on conflict (user_id) do update set
    is_premium    = excluded.is_premium,
    premium_until = excluded.premium_until,
    source        = 'admin',
    granted_by    = v_actor,
    reason        = excluded.reason,
    updated_at    = now();

  select to_jsonb(e) into v_after from public.user_entitlements e where e.user_id = p_user;

  insert into public.entitlement_audit (user_id, action, actor_id, before, after)
  values (p_user, case when p_is_premium then 'grant_premium' else 'revoke_premium' end, v_actor, v_before, v_after);
end;
$$;
grant execute on function public.admin_set_premium(uuid, boolean, timestamptz, text) to authenticated;

-- ─────────────────────────────────────────────────────────
-- 5) RLS — čtení vlastních práv, zápis nikdy z klienta
-- ─────────────────────────────────────────────────────────
alter table public.subscriptions      enable row level security;
alter table public.user_entitlements  enable row level security;
alter table public.entitlement_audit  enable row level security;

drop policy if exists "ent: select own" on public.user_entitlements;
create policy "ent: select own" on public.user_entitlements for select
  using (auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "subs: select own" on public.subscriptions;
create policy "subs: select own" on public.subscriptions for select
  using (auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "audit: admin select" on public.entitlement_audit;
create policy "audit: admin select" on public.entitlement_audit for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ZÁMĚRNĚ žádná INSERT/UPDATE/DELETE politika pro klienta:
-- zápis smí jen SECURITY DEFINER funkce výše.

-- ─────────────────────────────────────────────────────────
-- 6) GRANTy (bez nich „permission denied", viz migrace 029)
-- ─────────────────────────────────────────────────────────
grant select on public.user_entitlements, public.subscriptions, public.entitlement_audit to authenticated;
