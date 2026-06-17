-- HistoryGuessr · Migrace 021 · Přátelé + unikátní přezdívka
--
-- Přátelství: jeden řádek (requester -> addressee, status pending/accepted).
-- Veškerý přístup jde přes SECURITY DEFINER RPC, aby se nemusela rozvolnit
-- RLS na profiles (hledání podle přezdívky vrací jen username + xp).
--
-- Spusť v Supabase SQL editoru. Idempotentní.

-- ── Unikátní přezdívka (case-insensitive) ─────────────────
create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

-- ── Tabulka přátelství ────────────────────────────────────
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending',  -- pending | accepted
  created_at   timestamptz not null default now(),
  unique (requester_id, addressee_id)
);

alter table public.friendships enable row level security;
-- Přístup výhradně přes RPC (SECURITY DEFINER) — žádné přímé client politiky.

-- ── Odeslání / přijetí žádosti ────────────────────────────
create or replace function public.send_friend_request(p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_target uuid;
  v_existing record;
begin
  if v_me is null then return 'unauthorized'; end if;

  select id into v_target from public.profiles
   where lower(username) = lower(trim(p_username)) limit 1;

  if v_target is null then return 'not_found'; end if;
  if v_target = v_me then return 'self'; end if;

  -- Už existuje vztah v libovolném směru?
  select * into v_existing from public.friendships
   where (requester_id = v_me and addressee_id = v_target)
      or (requester_id = v_target and addressee_id = v_me)
   limit 1;

  if found then
    if v_existing.status = 'accepted' then
      return 'already_friends';
    end if;
    -- Protistrana mi už poslala žádost → rovnou přijmout
    if v_existing.requester_id = v_target then
      update public.friendships set status = 'accepted'
       where requester_id = v_target and addressee_id = v_me;
      return 'accepted';
    end if;
    return 'pending'; -- moje žádost už čeká
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (v_me, v_target, 'pending');
  return 'sent';
end;
$$;

-- ── Odpověď na příchozí žádost ────────────────────────────
create or replace function public.respond_friend_request(p_requester uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then return; end if;
  if p_accept then
    update public.friendships set status = 'accepted'
     where requester_id = p_requester and addressee_id = v_me and status = 'pending';
  else
    delete from public.friendships
     where requester_id = p_requester and addressee_id = v_me and status = 'pending';
  end if;
end;
$$;

-- ── Odebrání přítele / zrušení žádosti ────────────────────
create or replace function public.remove_friend(p_friend_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then return; end if;
  delete from public.friendships
   where (requester_id = v_me and addressee_id = p_friend_id)
      or (requester_id = p_friend_id and addressee_id = v_me);
end;
$$;

-- ── Seznam přátel (s profilem) ────────────────────────────
create or replace function public.get_friends()
returns table (id uuid, username text, xp int)
language sql
security definer
set search_path = public
as $$
  select pr.id, pr.username, pr.xp
    from public.friendships f
    join public.profiles pr
      on pr.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
   where (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
     and f.status = 'accepted'
   order by pr.username;
$$;

-- ── Příchozí čekající žádosti ─────────────────────────────
create or replace function public.get_friend_requests()
returns table (id uuid, username text, xp int)
language sql
security definer
set search_path = public
as $$
  select pr.id, pr.username, pr.xp
    from public.friendships f
    join public.profiles pr on pr.id = f.requester_id
   where f.addressee_id = auth.uid() and f.status = 'pending'
   order by f.created_at desc;
$$;

grant execute on function public.send_friend_request(text)        to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid)              to authenticated;
grant execute on function public.get_friends()                    to authenticated;
grant execute on function public.get_friend_requests()            to authenticated;
