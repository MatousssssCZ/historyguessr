-- HistoryGuessr · Migrace 007 · Časově řízený postup kol (bez hosta)
-- Kterýkoli hráč v místnosti může posunout kolo; díky zámku řádku
-- a guardu `current_round = expected` se posun provede jen jednou.
--
-- Spusť v Supabase SQL editoru.

create or replace function public.advance_multiplayer_round(
  p_room_id uuid,
  p_expected_round int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_next  int;
  v_now   timestamptz := now();
begin
  -- Jen účastník místnosti smí posouvat
  if not exists (
    select 1 from public.multiplayer_players
    where room_id = p_room_id and user_id = auth.uid()
  ) then
    return;
  end if;

  -- Zamkni řádek místnosti a ověř, že jsme pořád na očekávaném kole.
  -- FOR UPDATE serializuje souběžné volání → druhý už uvidí posunuté kolo.
  select (settings->>'rounds')::int
    into v_total
    from public.multiplayer_rooms
   where id = p_room_id and current_round = p_expected_round
   for update;

  if not found then
    return;  -- někdo už posunul (idempotence)
  end if;

  v_next := p_expected_round + 1;

  if v_next > v_total then
    -- Konec hry
    update public.multiplayer_rooms
       set status = 'finished', updated_at = v_now
     where id = p_room_id and current_round = p_expected_round;
  else
    -- Nastav start dalšího kola (3s odpočet) a posuň current_round
    update public.multiplayer_rounds
       set started_at = v_now + interval '3 seconds'
     where room_id = p_room_id and round_number = v_next;

    update public.multiplayer_rooms
       set current_round = v_next, updated_at = v_now
     where id = p_room_id and current_round = p_expected_round;
  end if;
end;
$$;

-- Povol volání přihlášeným uživatelům (autorizace je uvnitř funkce)
grant execute on function public.advance_multiplayer_round(uuid, int) to authenticated;
