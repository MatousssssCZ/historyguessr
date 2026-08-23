-- Iterace 4: host controls (vyhodit hráče, stav „připraven") + migrace hostitelství
-- při odchodu, ať místnost nezůstane osiřelá.

alter table public.multiplayer_players
  add column if not exists ready boolean not null default false;

-- Host vyhodí hráče z čekající místnosti
create or replace function public.kick_player(p_room uuid, p_user uuid)
  returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (
    select 1 from public.multiplayer_rooms
     where id = p_room and host_id = auth.uid() and status = 'waiting'
  ) then raise exception 'not_host_or_not_waiting'; end if;
  if p_user = auth.uid() then return; end if;  -- host nevyhodí sám sebe
  delete from public.multiplayer_players where room_id = p_room and user_id = p_user;
  update public.game_invites set status = 'expired'
   where room_id = p_room and to_user_id = p_user and status = 'pending';
end $$;
grant execute on function public.kick_player(uuid, uuid) to authenticated;

-- Hráč nastaví svůj stav „připraven"
create or replace function public.set_ready(p_room uuid, p_ready boolean)
  returns void language plpgsql security definer set search_path to 'public' as $$
begin
  update public.multiplayer_players set ready = p_ready
   where room_id = p_room and user_id = auth.uid();
end $$;
grant execute on function public.set_ready(uuid, boolean) to authenticated;

-- Odchod z místnosti s migrací hostitelství na dalšího hráče
create or replace function public.leave_multiplayer_room(p_room uuid)
  returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_me        uuid := auth.uid();
  v_was_host  boolean;
  v_next      uuid;
  v_remaining int;
begin
  select (host_id = v_me) into v_was_host from public.multiplayer_rooms where id = p_room;
  delete from public.multiplayer_players where room_id = p_room and user_id = v_me;
  select count(*) into v_remaining from public.multiplayer_players where room_id = p_room;

  if v_remaining = 0 then
    update public.multiplayer_rooms set status = 'finished', updated_at = now() where id = p_room;
  elsif coalesce(v_was_host, false) then
    select user_id into v_next from public.multiplayer_players
      where room_id = p_room order by joined_at asc limit 1;
    update public.multiplayer_players set is_host = (user_id = v_next) where room_id = p_room;
    update public.multiplayer_rooms set host_id = v_next, updated_at = now() where id = p_room;
  else
    update public.multiplayer_rooms set updated_at = now() where id = p_room;
  end if;
end $$;
grant execute on function public.leave_multiplayer_room(uuid) to authenticated;
