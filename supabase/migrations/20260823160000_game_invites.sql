-- Pozvánky do multiplayer místnosti pro přátele (in-app doručení přes Realtime).
-- Anti-spam: jen přátelé, jedna živá pozvánka na dvojici+místnost, cooldown po
-- odmítnutí, rate-limit, ztlumení příjemcem. Vynuceno serverově (SECURITY DEFINER).

-- ── Tabulky ─────────────────────────────────────────────────────────────────
create table if not exists public.game_invites (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.multiplayer_rooms(id) on delete cascade,
  room_code     text not null,
  from_user_id  uuid not null references auth.users(id) on delete cascade,
  from_username text not null,
  to_user_id    uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending','accepted','declined','expired')),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '15 minutes',
  unique (from_user_id, to_user_id, room_id)
);
create index if not exists game_invites_to_idx on public.game_invites (to_user_id, status);
alter table public.game_invites enable row level security;

create table if not exists public.invite_mutes (
  muter_id   uuid not null references auth.users(id) on delete cascade,
  muted_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id)
);
alter table public.invite_mutes enable row level security;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- game_invites: čte odesílatel i příjemce; příjemce smí měnit stav; INSERT jen
-- přes send_game_invite() (definer) → žádná insert policy = přímý insert zakázán.
drop policy if exists "gi: read own" on public.game_invites;
create policy "gi: read own" on public.game_invites for select to authenticated
  using (to_user_id = auth.uid() or from_user_id = auth.uid());

drop policy if exists "gi: recipient responds" on public.game_invites;
create policy "gi: recipient responds" on public.game_invites for update to authenticated
  using (to_user_id = auth.uid()) with check (to_user_id = auth.uid());

-- invite_mutes: uživatel spravuje jen svá ztlumení
drop policy if exists "mutes: own" on public.invite_mutes;
create policy "mutes: own" on public.invite_mutes for all to authenticated
  using (muter_id = auth.uid()) with check (muter_id = auth.uid());

-- ── Odeslání pozvánky (anti-spam) ───────────────────────────────────────────
create or replace function public.send_game_invite(p_room_id uuid, p_to uuid)
  returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_from     uuid := auth.uid();
  v_room     record;
  v_from_name text;
  v_existing record;
begin
  if v_from is null then raise exception 'unauthorized'; end if;
  if v_from = p_to then return; end if;

  select r.id, r.code, r.status into v_room from public.multiplayer_rooms r where r.id = p_room_id;
  if not found or v_room.status <> 'waiting' then raise exception 'room_not_open'; end if;

  if not exists (select 1 from public.multiplayer_players where room_id = p_room_id and user_id = v_from) then
    raise exception 'not_in_room';
  end if;

  if not exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = v_from and f.addressee_id = p_to)
        or (f.requester_id = p_to and f.addressee_id = v_from))
  ) then raise exception 'not_friends'; end if;

  -- ztlumeno příjemcem → tiše (odesílatel se nedozví)
  if exists (select 1 from public.invite_mutes where muter_id = p_to and muted_id = v_from) then return; end if;
  -- příjemce už je v místnosti → není co posílat
  if exists (select 1 from public.multiplayer_players where room_id = p_room_id and user_id = p_to) then return; end if;

  -- rate-limit: max 10 čekajících odeslaných za poslední minutu
  if (select count(*) from public.game_invites
       where from_user_id = v_from and status = 'pending' and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'rate_limit';
  end if;

  select * into v_existing from public.game_invites
    where from_user_id = v_from and to_user_id = p_to and room_id = p_room_id;
  if found then
    if v_existing.status = 'pending' then return; end if;  -- už pozván (tiše)
    if v_existing.status in ('declined','expired') and v_existing.created_at > now() - interval '10 minutes' then
      raise exception 'cooldown';
    end if;
    update public.game_invites
       set status = 'pending', created_at = now(), expires_at = now() + interval '15 minutes', room_code = v_room.code
     where id = v_existing.id;
    return;
  end if;

  select username into v_from_name from public.profiles where id = v_from;
  insert into public.game_invites (room_id, room_code, from_user_id, from_username, to_user_id)
  values (p_room_id, v_room.code, v_from, coalesce(v_from_name, 'Hráč'), p_to);
end $$;
grant execute on function public.send_game_invite(uuid, uuid) to authenticated;

-- ── Odpověď příjemce ────────────────────────────────────────────────────────
create or replace function public.respond_game_invite(p_invite uuid, p_accept boolean)
  returns void language plpgsql security definer set search_path to 'public' as $$
begin
  update public.game_invites
     set status = case when p_accept then 'accepted' else 'declined' end
   where id = p_invite and to_user_id = auth.uid() and status = 'pending';
end $$;
grant execute on function public.respond_game_invite(uuid, boolean) to authenticated;

-- ── Auto-expirace: jakmile místnost opustí 'waiting' (start/konec), zruš pozvánky ──
create or replace function public.expire_room_invites()
  returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status <> 'waiting' and old.status = 'waiting' then
    update public.game_invites set status = 'expired' where room_id = new.id and status = 'pending';
  end if;
  return new;
end $$;
drop trigger if exists trg_expire_room_invites on public.multiplayer_rooms;
create trigger trg_expire_room_invites after update of status on public.multiplayer_rooms
  for each row execute function public.expire_room_invites();

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_invites'
  ) then
    alter publication supabase_realtime add table public.game_invites;
  end if;
end $$;
