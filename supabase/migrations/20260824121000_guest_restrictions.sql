-- Omezení pro hosty (anonymní účty, is_anonymous = true):
--  (1) nemohou posílat/přijímat pozvánky do MP (jen registrovaní)
--  (4) nemohou hodnotit panoramata
--  (7) nemohou zakládat MP místnosti (mohou se jen připojit kódem/pozvánkou)
-- Idempotentní.

-- ── (1) Pozvánky do MP jen mezi registrovanými ──────────────────────────────
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

  -- host (anonymní) nemůže posílat pozvánky, ani zvát hosta
  if coalesce((select is_anonymous from public.profiles where id = v_from), false) then
    raise exception 'guest_forbidden';
  end if;
  if coalesce((select is_anonymous from public.profiles where id = p_to), false) then
    raise exception 'guest_target';
  end if;

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

  if exists (select 1 from public.invite_mutes where muter_id = p_to and muted_id = v_from) then return; end if;
  if exists (select 1 from public.multiplayer_players where room_id = p_room_id and user_id = p_to) then return; end if;

  if (select count(*) from public.game_invites
       where from_user_id = v_from and status = 'pending' and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'rate_limit';
  end if;

  select * into v_existing from public.game_invites
    where from_user_id = v_from and to_user_id = p_to and room_id = p_room_id;
  if found then
    if v_existing.status = 'pending' then return; end if;
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

-- ── (4) Hodnocení panoramat jen pro registrované ────────────────────────────
create or replace function public.add_event_rating(p_event_id uuid, p_rating integer)
  returns void language plpgsql security definer set search_path to 'public' as $$
begin
  -- host (anonymní) nehodnotí — tiše ignoruj (klient tlačítko stejně skryje)
  if coalesce((select is_anonymous from public.profiles where id = auth.uid()), false) then
    return;
  end if;
  if p_rating < 1 or p_rating > 5 then return; end if;
  update public.events
     set rating_sum   = rating_sum + p_rating,
         rating_count = rating_count + 1
   where id = p_event_id;
end $$;

-- ── (7) MP místnost může založit jen registrovaný ───────────────────────────
-- Insert je přímý (ne RPC), povolený permisivní politikou. Přidáme RESTRICTIVE
-- politiku (AND) která hosta odmítne — připojení (multiplayer_players) zůstává OK.
drop policy if exists "rooms: no guest host" on public.multiplayer_rooms;
create policy "rooms: no guest host" on public.multiplayer_rooms
  as restrictive for insert to authenticated
  with check (not coalesce((select is_anonymous from public.profiles where id = auth.uid()), false));
