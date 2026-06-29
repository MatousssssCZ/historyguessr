-- HistoryGuessr · Migrace 025 · Mírnější bodování za rok (2× méně přísné)
--
-- YEAR_DECAY 120 → 240 (stejně jako scoring.ts). Přepisuje server RPC
-- submit_multiplayer_answer, aby multiplayer počítal shodně s klientem.
-- Jediná změna oproti migraci 014: dělitel u roku 120.0 → 240.0.
--
-- Spusť v Supabase SQL editoru. Idempotentní (create or replace).

create or replace function public.submit_multiplayer_answer(
  p_room_id uuid,
  p_round_number int,
  p_guess_lat double precision,
  p_guess_lng double precision,
  p_guess_year int
)
returns table (location_score int, year_score int, round_score int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_event_id uuid;
  v_lat double precision; v_lng double precision;
  v_yf int; v_yt int; v_radius double precision;
  v_dist double precision; v_over double precision;
  v_loc int; v_year int; v_total int;
  v_a double precision;
  v_inserted int;
begin
  if v_uid is null or not exists (
    select 1 from public.multiplayer_players
     where room_id = p_room_id and user_id = v_uid
  ) then
    raise exception 'not a participant';
  end if;

  select e.id, e.lat, e.lng,
         coalesce(e.year_from, e.year), coalesce(e.year_to, e.year),
         coalesce(e.location_radius_km, 0)
    into v_event_id, v_lat, v_lng, v_yf, v_yt, v_radius
    from public.multiplayer_rounds r
    join public.events e on e.id = r.event_id
   where r.room_id = p_room_id and r.round_number = p_round_number;

  if v_event_id is null then
    raise exception 'round not found';
  end if;

  v_a := sin(radians(p_guess_lat - v_lat)/2)^2
       + cos(radians(v_lat)) * cos(radians(p_guess_lat))
       * sin(radians(p_guess_lng - v_lng)/2)^2;
  v_dist := 6371 * 2 * atan2(sqrt(v_a), sqrt(1 - v_a));

  v_over := greatest(0, v_dist - v_radius);
  v_loc := round(500 * exp(-v_over / 1500.0));

  if p_guess_year between v_yf and v_yt then
    v_year := 500;
  else
    v_over := case when p_guess_year < v_yf then v_yf - p_guess_year
                   else p_guess_year - v_yt end;
    v_year := round(500 * exp(-v_over / 240.0));
  end if;

  v_total := v_loc + v_year;

  insert into public.multiplayer_answers
    (room_id, round_number, user_id, guess_lat, guess_lng, guess_year,
     location_score, year_score, round_score)
  values
    (p_room_id, p_round_number, v_uid, p_guess_lat, p_guess_lng, p_guess_year,
     v_loc, v_year, v_total)
  on conflict (room_id, round_number, user_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    update public.multiplayer_players
       set total_score = coalesce(total_score, 0) + v_total
     where room_id = p_room_id and user_id = v_uid;
  end if;

  location_score := v_loc;
  year_score := v_year;
  round_score := v_total;
  return next;
end;
$$;

grant execute on function public.submit_multiplayer_answer(uuid, int, double precision, double precision, int) to authenticated;
