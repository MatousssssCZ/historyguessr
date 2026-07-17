-- HistoryGuessr · Migrace 033 · Serverové skórování pro Daily a solo hru
--
-- Dosud počítal skóre KLIENT a server ho slepě uložil → v konzoli šlo poslat
-- libovolné skóre i XP. Tato migrace překlápí i poslední režimy na server.
-- (Multiplayer a kampaně už server-authoritative jsou — 025/031/032.)
--
-- Obsah:
--   1) ZAVŘENÍ DĚR: add_xp() a increment_user_score() byly SECURITY DEFINER
--      s parametrem p_user_id a BEZ kontroly volajícího → kdokoli si (nebo
--      komukoli) mohl přidat libovolné XP/skóre. Odebíráme je klientovi;
--      volají je už jen serverové funkce níže.
--   2) daily_starts + start_daily_challenge() — čas startu drží SERVER,
--      takže XP násobič za rychlost nejde podvrhnout ani refreshem.
--   3) submit_daily_result() — skóre počítá server ze svého vzoru pravdy.
--   4) submit_game_session() — server přepočítá VŠECHNA kola z tipů.
--
-- Vše staví na sdíleném jádru public.score_event_guess() z migrace 031.
--
-- Spusť v Supabase SQL editoru. Idempotentní. Vyžaduje migraci 031.

-- ═════════════════════════════════════════════════════════
-- 1) Zavření děr v XP / skóre
-- ═════════════════════════════════════════════════════════
-- Klient je už volat nesmí. Interní volání z jiných SECURITY DEFINER funkcí
-- běží pod vlastníkem, takže dál fungují.
revoke execute on function public.add_xp(uuid, int) from authenticated;
revoke execute on function public.increment_user_score(uuid, int) from authenticated;

-- Pojistka i uvnitř: cizí uživatel nikdy
create or replace function public.add_xp(p_user_id uuid, p_amount int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then return; end if;
  update public.profiles
     set xp = coalesce(xp, 0) + p_amount
   where id = p_user_id;
end;
$$;

-- ═════════════════════════════════════════════════════════
-- 2) Denní výzva — start drží server
-- ═════════════════════════════════════════════════════════
create table if not exists public.daily_starts (
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  started_at timestamptz not null default now(),
  primary key (user_id, date)
);
alter table public.daily_starts enable row level security;
drop policy if exists "dstart: select own" on public.daily_starts;
create policy "dstart: select own" on public.daily_starts for select using (auth.uid() = user_id);
grant select on public.daily_starts to authenticated;

-- Datum musí odpovídat „dnešku" (tolerance ±1 den kvůli časovým pásmům klientů)
create or replace function public.valid_daily_date(p_date date)
returns boolean language sql stable as $$
  select p_date between ((now() at time zone 'utc')::date - 1)
                    and ((now() at time zone 'utc')::date + 1)
$$;

/** Zahájí (nebo vrátí už zahájenou) dnešní výzvu. Opakované volání NEresetuje čas. */
create or replace function public.start_daily_challenge(p_date date)
returns table(started_at timestamptz, seconds_left int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_started timestamptz;
  v_limit int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.valid_daily_date(p_date) then raise exception 'invalid_date'; end if;

  insert into public.daily_starts (user_id, date) values (v_uid, p_date)
  on conflict (user_id, date) do nothing;

  select ds.started_at into v_started
    from public.daily_starts ds where ds.user_id = v_uid and ds.date = p_date;

  v_limit := public.config_int('daily_timer_seconds', 60);
  started_at   := v_started;
  seconds_left := greatest(0, v_limit - floor(extract(epoch from (now() - v_started)))::int);
  return next;
end;
$$;
grant execute on function public.start_daily_challenge(date) to authenticated;

-- Unikát na jeden výsledek za den (pojistka — tabulka vznikla mimo migrace)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'daily_results_user_date_key'
  ) then
    begin
      alter table public.daily_results
        add constraint daily_results_user_date_key unique (user_id, date);
    exception when others then
      raise notice 'daily_results unique(user_id,date) už existuje nebo nelze přidat: %', sqlerrm;
    end;
  end if;
end $$;

/**
 * Odešle denní výzvu. Klient posílá JEN tip; skóre i XP násobič počítá server
 * (násobič z vlastního started_at → refresh ani konzole ho neovlivní).
 * Idempotentní: druhý pokus vrátí už uložený výsledek.
 */
create or replace function public.submit_daily_result(
  p_date       date,
  p_guess_lat  double precision,
  p_guess_lng  double precision,
  p_guess_year int
)
returns table (location_score int, year_score int, round_score int,
               distance_km double precision, year_diff int, xp_awarded int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_event uuid;
  v_loc int; v_year int; v_total int; v_dist double precision; v_yd int;
  v_glat double precision; v_glng double precision; v_gyear int;
  v_started timestamptz; v_limit int; v_remain int; v_mult numeric := 1;
  v_xp int; v_inserted int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.valid_daily_date(p_date) then raise exception 'invalid_date'; end if;

  -- Pravda: událost přiřazená na tento den
  select a.event_id into v_event
    from public.daily_challenge_assignments a
   where a.month = extract(month from p_date)::int
     and a.day = extract(day from p_date)::int;
  if v_event is null then raise exception 'no_challenge'; end if;

  -- Už odehráno → přepočti z ULOŽENÉHO tipu a vrať (idempotence, bez další XP)
  select dr.guess_lat, dr.guess_lng, dr.guess_year
    into v_glat, v_glng, v_gyear
    from public.daily_results dr
   where dr.user_id = v_uid and dr.date = p_date;
  if found then
    select s.location_score, s.year_score, s.round_score, s.distance_km, s.year_diff
      into v_loc, v_year, v_total, v_dist, v_yd
      from public.score_event_guess(v_event, v_glat, v_glng, v_gyear) s;
    location_score := v_loc; year_score := v_year; round_score := v_total;
    distance_km := v_dist; year_diff := v_yd; xp_awarded := 0;
    return next;
    return;
  end if;

  select s.location_score, s.year_score, s.round_score, s.distance_km, s.year_diff
    into v_loc, v_year, v_total, v_dist, v_yd
    from public.score_event_guess(v_event, p_guess_lat, p_guess_lng, p_guess_year) s;

  -- XP násobič ze SERVEROVÉHO času startu (čas/10, jen když zbývá ≥ 10 s)
  v_limit := public.config_int('daily_timer_seconds', 60);
  select ds.started_at into v_started
    from public.daily_starts ds where ds.user_id = v_uid and ds.date = p_date;
  if v_started is not null then
    v_remain := greatest(0, v_limit - floor(extract(epoch from (now() - v_started)))::int);
    if v_remain >= 10 then v_mult := v_remain / 10.0; end if;
  end if;
  -- strop dle délky kola (nikdy víc, než kolik jde reálně stihnout)
  v_mult := least(v_mult, greatest(1, v_limit / 10.0));

  insert into public.daily_results (user_id, date, score, guess_lat, guess_lng, guess_year)
  values (v_uid, p_date, v_total, p_guess_lat, p_guess_lng, p_guess_year)
  on conflict (user_id, date) do nothing;
  get diagnostics v_inserted = row_count;

  v_xp := 0;
  if v_inserted = 1 then
    -- XP: (skóre + bonus) × násobič za rychlost. Bonus musí sedět s leveling.ts.
    v_xp := round((v_total + 300) * v_mult);
    perform public.add_xp(v_uid, v_xp);
  end if;

  location_score := v_loc; year_score := v_year; round_score := v_total;
  distance_km := v_dist; year_diff := v_yd; xp_awarded := v_xp;
  return next;
end;
$$;
grant execute on function public.submit_daily_result(date, double precision, double precision, int) to authenticated;

-- ═════════════════════════════════════════════════════════
-- 3) Solo hra — server přepočítá všechna kola z tipů
--     p_guesses = [{"event_id":"…","lat":50.1,"lng":14.4,"year":1620}, …]
-- ═════════════════════════════════════════════════════════
create or replace function public.submit_game_session(
  p_session_id uuid,
  p_guesses    jsonb
)
returns table (total_score int, xp_awarded int, rounds jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid; v_finished timestamptz;
  g jsonb;
  v_lat double precision; v_lng double precision; v_year int; v_event uuid;
  v_loc int; v_yr int; v_tot int; v_dist double precision; v_yd int;
  v_rounds jsonb := '[]'::jsonb;
  v_total int := 0;
  v_xp int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select gs.user_id, gs.finished_at into v_owner, v_finished
    from public.game_sessions gs where gs.id = p_session_id;
  if v_owner is null then raise exception 'session_not_found'; end if;
  if v_owner <> v_uid then raise exception 'forbidden'; end if;

  -- Idempotence: dokončenou hru už nepřepočítáváme ani znovu neodměňujeme
  if v_finished is not null then
    return query select gs.total_score, 0, gs.rounds
      from public.game_sessions gs where gs.id = p_session_id;
    return;
  end if;

  if jsonb_typeof(p_guesses) <> 'array' or jsonb_array_length(p_guesses) = 0 then
    raise exception 'no_rounds';
  end if;

  for g in select * from jsonb_array_elements(p_guesses) loop
    v_event := (g->>'event_id')::uuid;
    v_lat   := nullif(g->>'lat', '')::double precision;
    v_lng   := nullif(g->>'lng', '')::double precision;
    v_year  := coalesce((g->>'year')::int, 0);

    select s.location_score, s.year_score, s.round_score, s.distance_km, s.year_diff
      into v_loc, v_yr, v_tot, v_dist, v_yd
      from public.score_event_guess(v_event, v_lat, v_lng, v_year) s;

    v_total := v_total + v_tot;
    v_rounds := v_rounds || jsonb_build_object(
      'event_id', v_event, 'guess_lat', v_lat, 'guess_lng', v_lng, 'guess_year', v_year,
      'distance_km', v_dist, 'year_diff', v_yd,
      'location_score', v_loc, 'year_score', v_yr, 'round_score', v_tot
    );
  end loop;

  update public.game_sessions
     set rounds = v_rounds, total_score = v_total, finished_at = now()
   where id = p_session_id;

  -- XP: body + bonus za dohranou hru (musí sedět s leveling.ts)
  v_xp := v_total + 500;
  perform public.add_xp(v_uid, v_xp);
  perform public.increment_user_score(v_uid, v_total);

  total_score := v_total; xp_awarded := v_xp; rounds := v_rounds;
  return next;
end;
$$;
grant execute on function public.submit_game_session(uuid, jsonb) to authenticated;

-- ═════════════════════════════════════════════════════════
-- 4) Multiplayer — XP uděluje také server
--     Dosud klient po RPC volal add_xp(round_score) s VLASTNÍM číslem.
--     Teď XP přizná RPC z ověřeného skóre, jen při skutečném vložení odpovědi.
-- ═════════════════════════════════════════════════════════
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
  v_loc int; v_year int; v_total int;
  v_inserted int;
begin
  if v_uid is null or not exists (
    select 1 from public.multiplayer_players
     where room_id = p_room_id and user_id = v_uid
  ) then
    raise exception 'not a participant';
  end if;

  select r.event_id into v_event_id
    from public.multiplayer_rounds r
   where r.room_id = p_room_id and r.round_number = p_round_number;
  if v_event_id is null then raise exception 'round not found'; end if;

  select s.location_score, s.year_score, s.round_score
    into v_loc, v_year, v_total
    from public.score_event_guess(v_event_id, p_guess_lat, p_guess_lng, p_guess_year) s;

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
    -- XP z OVĚŘENÉHO skóre (dřív si ho posílal klient sám)
    perform public.add_xp(v_uid, v_total);
  end if;

  location_score := v_loc;
  year_score := v_year;
  round_score := v_total;
  return next;
end;
$$;
grant execute on function public.submit_multiplayer_answer(uuid, int, double precision, double precision, int) to authenticated;

-- Konfigurace délky denního kola (jeden zdroj pravdy)
insert into public.app_config (key, value) values ('daily_timer_seconds', '60'::jsonb)
on conflict (key) do nothing;
