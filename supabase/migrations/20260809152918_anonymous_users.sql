-- HistoryGuessr · Anonymní hráči (hraní bez registrace)
--
-- Persistentní anonym přes Supabase Anonymous Auth: každý anon má skutečný
-- účet (auth.users.is_anonymous = true) → plná perzistence XP/série/odznaků,
-- později upgrade na e-mail se zachováním dat. Žebříčky jsou JEN pro
-- registrované → anonymy z nich vyloučíme.
--
-- Idempotentní. Testuj lokálně `supabase db reset`, pak spusť na produkci.
-- ⚠ Na produkci navíc zapni Anonymous sign-ins v Supabase dashboardu.

alter table public.profiles add column if not exists is_anonymous boolean not null default false;

-- Profil při vzniku uživatele nese příznak anonyma.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, is_anonymous)
  values (new.id, new.email, coalesce(new.is_anonymous, false))
  on conflict (id) do nothing;
  return new;
end $$;

-- Backfill stávajících profilů z auth.users (registrovaní = false).
update public.profiles p
   set is_anonymous = coalesce(u.is_anonymous, false)
  from auth.users u
 where u.id = p.id
   and p.is_anonymous is distinct from coalesce(u.is_anonymous, false);

-- Konverze anonyma na účet: Supabase překlopí auth.users.is_anonymous → false,
-- tenhle trigger to promítne do profiles (jinak by zůstal mimo žebříčky).
create or replace function public.sync_profile_anon()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set is_anonymous = coalesce(new.is_anonymous, false),
                             email = coalesce(new.email, email)
   where id = new.id;
  return new;
end $$;
drop trigger if exists on_auth_user_anon_sync on auth.users;
create trigger on_auth_user_anon_sync
  after update of is_anonymous on auth.users
  for each row execute function public.sync_profile_anon();

-- Světový žebříček počítá jen registrované (anonym neleze do pořadí).
create or replace function public.get_world_rank()
returns table(rank bigint, total bigint)
language sql security definer set search_path = public as $$
  select
    (select count(*) from public.profiles p
       where not p.is_anonymous
         and coalesce(p.xp, 0) > coalesce((select xp from public.profiles where id = auth.uid()), 0)
    ) + 1 as rank,
    (select count(*) from public.profiles where not is_anonymous) as total
$$;
grant execute on function public.get_world_rank() to authenticated;
