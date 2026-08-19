-- Reporting: ukazovat počet odehraných KOL místo her.
-- report_overview: games_total → rounds_total (součet profiles.rounds_played).
-- report_daily_series: sloupec games → rounds (kola dokončená v daný den).

create or replace function public.report_overview()
returns table(metric text, value numeric)
language plpgsql security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select 'registered'::text, count(*)::numeric from public.profiles
    union all select 'with_username', count(*) from public.profiles where username is not null
    union all select 'active_today', count(distinct user_id) from public.analytics_events
      where user_id is not null and event_name in ('game_started','daily_challenge_started') and created_at::date = now()::date
    union all select 'active_7d', count(distinct user_id) from public.analytics_events
      where user_id is not null and event_name in ('game_started','daily_challenge_started') and created_at >= now() - interval '7 days'
    union all select 'active_30d', count(distinct user_id) from public.analytics_events
      where user_id is not null and event_name in ('game_started','daily_challenge_started') and created_at >= now() - interval '30 days'
    union all select 'rounds_total', coalesce(sum(rounds_played), 0) from public.profiles
    union all select 'daily_assigned', count(*) from public.daily_challenge_assignments where event_id is not null
    union all select 'events_published', count(*) from public.events where published = true
    union all select 'events_hidden', count(*) from public.events where published = false
    union all select 'events_no_panorama', count(*) from public.events where panorama_url is null or panorama_url in ('', 'pending')
    union all select 'events_no_translation', count(*) from public.events where title_en is null or title_de is null;
end; $function$;
grant all on function public.report_overview() to authenticated;

drop function if exists public.report_daily_series(integer);
create function public.report_daily_series(p_days integer)
returns table(day date, new_users integer, active_users integer, rounds integer)
language plpgsql security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    with days as (
      select generate_series(now()::date - (p_days - 1), now()::date, interval '1 day')::date as d
    )
    select d.d,
      (select count(*)::int from public.profiles p where p.created_at::date = d.d),
      (select count(distinct ae.user_id)::int from public.analytics_events ae
         where ae.user_id is not null and ae.event_name in ('game_started','daily_challenge_started') and ae.created_at::date = d.d),
      (coalesce((select sum(jsonb_array_length(gs.rounds))::int from public.game_sessions gs where gs.finished_at::date = d.d), 0)
       + coalesce((select count(*)::int from public.daily_results dr where dr.date = d.d), 0)
       + coalesce((select count(*)::int from public.multiplayer_answers ma where ma.submitted_at::date = d.d), 0))
    from days d order by d.d;
end; $function$;
grant all on function public.report_daily_series(integer) to authenticated;
