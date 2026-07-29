-- HistoryGuessr · Migrace 020 · Battle Royale režim
--
-- Po každém kole vypadává hráč s nejnižším skóre kola. Při SHODĚ o poslední
-- místo (varianta 1) NEvypadne nikdo — u posledních dvou se tak přirozeně
-- hraje „sudden death" další kolo. Hra končí, když zbude 1 živý hráč
-- (nebo dojdou kola → vyhrává nejvyšší celkové skóre).
--
-- Spusť v Supabase SQL editoru. Idempotentní.

alter table public.multiplayer_players
  add column if not exists eliminated       boolean not null default false,
  add column if not exists eliminated_round  int;

create or replace function public.advance_battle_royale(
  p_room_id uuid,
  p_expected_round int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min int;
  v_min_count int;
  v_alive int;
  v_next int;
  v_has_next boolean;
  v_now timestamptz := now();
begin
  -- Jen účastník místnosti
  if not exists (select 1 from public.multiplayer_players
                 where room_id = p_room_id and user_id = auth.uid()) then
    return;
  end if;

  -- Zámek + ověření, že jsme pořád na očekávaném kole (idempotence)
  perform 1 from public.multiplayer_rooms
    where id = p_room_id and current_round = p_expected_round for update;
  if not found then
    return;
  end if;

  -- Skóre živých hráčů za toto kolo (chybějící odpověď = 0)
  with alive as (
    select p.user_id, coalesce(a.round_score, 0) as score
      from public.multiplayer_players p
      left join public.multiplayer_answers a
        on a.room_id = p.room_id and a.user_id = p.user_id
       and a.round_number = p_expected_round
     where p.room_id = p_room_id and p.eliminated = false
  )
  select min(score), count(*) filter (where score = (select min(score) from alive))
    into v_min, v_min_count
    from alive;

  select count(*) into v_alive
    from public.multiplayer_players
   where room_id = p_room_id and eliminated = false;

  -- Vyřaď jen když je víc než 1 živý a na minimu je PRÁVĚ JEDEN
  -- (shoda na posledním místě → nikdo nevypadne)
  if v_alive > 1 and v_min_count = 1 then
    update public.multiplayer_players mp
       set eliminated = true, eliminated_round = p_expected_round
     where mp.room_id = p_room_id and mp.eliminated = false
       and coalesce((
         select a.round_score from public.multiplayer_answers a
          where a.room_id = p_room_id and a.user_id = mp.user_id
            and a.round_number = p_expected_round
       ), 0) = v_min;
    v_alive := v_alive - 1;
  end if;

  -- Konec: zbývá 1 (nebo 0) živý hráč
  if v_alive <= 1 then
    update public.multiplayer_rooms
       set status = 'finished', updated_at = v_now
     where id = p_room_id and current_round = p_expected_round;
    return;
  end if;

  -- Existuje další kolo? Když ne, taky konec (vyhraje nejvyšší skóre)
  v_next := p_expected_round + 1;
  select exists(select 1 from public.multiplayer_rounds
                where room_id = p_room_id and round_number = v_next)
    into v_has_next;
  if not v_has_next then
    update public.multiplayer_rooms
       set status = 'finished', updated_at = v_now
     where id = p_room_id and current_round = p_expected_round;
    return;
  end if;

  -- Spusť další kolo (3s odpočet) a posuň current_round
  update public.multiplayer_rounds
     set started_at = v_now + interval '3 seconds'
   where room_id = p_room_id and round_number = v_next;
  update public.multiplayer_rooms
     set current_round = v_next, updated_at = v_now
   where id = p_room_id and current_round = p_expected_round;
end;
$$;

grant execute on function public.advance_battle_royale(uuid, int) to authenticated;
