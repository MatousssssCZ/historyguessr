-- HistoryGuessr · Migrace 043 · Bodování polohy ve 3 zónách
--
-- Nahrazuje jedinou exponenciálu (500 · e^(−km/1500)) třemi lineárními zónami:
--   0–250 km    500 → 450  (skoro trefa — pořád hodně bodů)
--   250–3000 km 450 → 200  (mírný pokles)
--   3000–5000 km 200 → 0    (velký pokles)
--   > 5000 km   0           (jiný kontinent = nula)
-- Rok se NEMĚNÍ (pořád 500 · e^(−roky/240)).
--
-- MUSÍ sedět s klientským src/lib/scoring.ts (locationScore / DIST_ZONES).
-- Spusť v Supabase SQL editoru. Idempotentní (create or replace).

-- Poloha jako 3 lineární zóny; `over` = vzdálenost po odečtení odpuštěného poloměru.
create or replace function public.location_score_zones(p_over double precision)
returns int
language sql
immutable
as $$
  select case
    when p_over <= 250  then round(500 + (p_over - 0)    / (250  - 0)    * (450 - 500))
    when p_over <= 3000 then round(450 + (p_over - 250)  / (3000 - 250)  * (200 - 450))
    when p_over <= 5000 then round(200 + (p_over - 3000) / (5000 - 3000) * (0   - 200))
    else 0
  end::int
$$;

create or replace function public.score_event_guess(
  p_event_id   uuid,
  p_guess_lat  double precision,
  p_guess_lng  double precision,
  p_guess_year int
)
returns table (
  location_score int,
  year_score     int,
  round_score    int,
  distance_km    double precision,
  year_diff      int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lat double precision; v_lng double precision;
  v_yf int; v_yt int; v_radius double precision;
  v_a double precision; v_dist double precision; v_over double precision;
  v_loc int; v_year int; v_ydiff int;
begin
  select e.lat, e.lng,
         coalesce(e.year_from, e.year), coalesce(e.year_to, e.year),
         coalesce(e.location_radius_km, 0)
    into v_lat, v_lng, v_yf, v_yt, v_radius
    from public.events e
   where e.id = p_event_id;

  if v_lat is null then raise exception 'event_not_found'; end if;

  -- Chybějící tip = maximální penalizace (nedá se získat nic zadarmo)
  if p_guess_lat is null or p_guess_lng is null then
    v_dist := 20000;
  else
    v_a := sin(radians(p_guess_lat - v_lat)/2)^2
         + cos(radians(v_lat)) * cos(radians(p_guess_lat))
         * sin(radians(p_guess_lng - v_lng)/2)^2;
    v_dist := 6371 * 2 * atan2(sqrt(v_a), sqrt(1 - v_a));
  end if;

  v_over := greatest(0, v_dist - v_radius);
  v_loc := public.location_score_zones(v_over);

  if p_guess_year between v_yf and v_yt then
    v_year  := 500;
    v_ydiff := 0;
  else
    v_ydiff := case when p_guess_year < v_yf then v_yf - p_guess_year
                    else p_guess_year - v_yt end;
    v_year  := round(500 * exp(-v_ydiff / 240.0));
  end if;

  location_score := v_loc;
  year_score     := v_year;
  round_score    := v_loc + v_year;
  distance_km    := v_dist;
  year_diff      := v_ydiff;
  return next;
end;
$$;
grant execute on function public.score_event_guess(uuid, double precision, double precision, int) to authenticated;
