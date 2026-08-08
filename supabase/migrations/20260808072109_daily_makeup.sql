-- HistoryGuessr · Doplnění zameškané denní výzvy (make-up)
--
-- Pravidla (dle rozhodnutí):
--   • 1 lístek na doplnění za každých 7 ODEHRANÝCH živých denních výzev
--   • doplnit lze zameškaný den z posledních 30 dní (ne dnešek/budoucnost)
--   • make-up zacelí sérii (uloží se s datem dne) + základní XP, BEZ časového
--     bonusu; do žebříčku dne se nedostane (ty filtrují date = dnes)
--   • skóre počítá server (score_event_guess) — nejde podvádět
--
-- Idempotentní. Testuj lokálně `supabase db reset`, pak spusť na produkci.

alter table public.daily_results add column if not exists is_makeup boolean not null default false;

-- Stav: kolik lístků + které dny lze doplnit (posledních 30 dní).
create or replace function public.daily_makeup_status()
returns table(balance int, missed date[])
language sql stable security definer set search_path = public as $$
  with played as (
    select
      count(*) filter (where not is_makeup) as live,
      count(*) filter (where is_makeup)     as used
    from public.daily_results where user_id = auth.uid()
  ),
  miss as (
    select g.d::date as dd
    from generate_series(
      (now() at time zone 'utc')::date - 30,
      (now() at time zone 'utc')::date - 1,
      interval '1 day') g(d)
    where exists (
      select 1 from public.daily_challenge_assignments a
       where a.month = extract(month from g.d)::int
         and a.day   = extract(day   from g.d)::int
         and a.event_id is not null)
      and not exists (
        select 1 from public.daily_results r
         where r.user_id = auth.uid() and r.date = g.d::date)
  )
  select
    greatest(0, (select floor(live / 7)::int - used from played)) as balance,
    coalesce((select array_agg(dd order by dd desc) from miss), '{}'::date[]) as missed;
$$;
grant execute on function public.daily_makeup_status() to authenticated;

-- Odeslání doplněné výzvy.
create or replace function public.submit_daily_makeup(
  p_date date, p_guess_lat double precision, p_guess_lng double precision, p_guess_year integer
)
returns table(
  location_score int, year_score int, round_score int,
  distance_km double precision, year_diff int, xp_awarded int
)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_event uuid;
  v_loc int; v_year int; v_total int; v_dist double precision; v_yd int;
  v_live int; v_used int; v_balance int;
  v_xp int; v_inserted int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_date < v_today - 30 or p_date > v_today - 1 then raise exception 'invalid_date'; end if;

  select a.event_id into v_event
    from public.daily_challenge_assignments a
   where a.month = extract(month from p_date)::int
     and a.day   = extract(day   from p_date)::int;
  if v_event is null then raise exception 'no_challenge'; end if;

  if exists (select 1 from public.daily_results r where r.user_id = v_uid and r.date = p_date) then
    raise exception 'already_played';
  end if;

  -- Zůstatek lístků (atomicky v transakci)
  select count(*) filter (where not is_makeup), count(*) filter (where is_makeup)
    into v_live, v_used
    from public.daily_results where user_id = v_uid;
  v_balance := floor(v_live / 7)::int - v_used;
  if v_balance < 1 then raise exception 'no_makeup_tokens'; end if;

  select s.location_score, s.year_score, s.round_score, s.distance_km, s.year_diff
    into v_loc, v_year, v_total, v_dist, v_yd
    from public.score_event_guess(v_event, p_guess_lat, p_guess_lng, p_guess_year) s;

  insert into public.daily_results (user_id, date, score, guess_lat, guess_lng, guess_year, is_makeup)
  values (v_uid, p_date, v_total, p_guess_lat, p_guess_lng, p_guess_year, true)
  on conflict (user_id, date) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted <> 1 then raise exception 'already_played'; end if;

  -- Základní XP bez časového bonusu (bonus musí sedět s leveling.ts)
  v_xp := v_total + 300;
  perform public.add_xp(v_uid, v_xp);

  location_score := v_loc; year_score := v_year; round_score := v_total;
  distance_km := v_dist; year_diff := v_yd; xp_awarded := v_xp;
  return next;
end;
$$;
grant execute on function public.submit_daily_makeup(date, double precision, double precision, integer) to authenticated;
