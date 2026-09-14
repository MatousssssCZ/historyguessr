-- Reporting: vynech aktivitu adminů (profiles.role = 'admin') ze statistik,
-- ať čísla odrážejí reálné hráče. Filtruje se všude, kde jde přiřadit user_id.
-- (Metriky založené na events.play_count — kategorie, žebříček událostí — nelze
--  zpětně očistit, protože je to sdílené počítadlo; ty zůstávají beze změny.)

create or replace function public.report_overview()
returns table(metric text, value numeric)
language plpgsql security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select 'registered'::text, count(*)::numeric from public.profiles where role <> 'admin' or role is null
    union all select 'with_username', count(*) from public.profiles where username is not null and (role <> 'admin' or role is null)
    union all select 'active_today', count(distinct user_id) from public.analytics_events
      where user_id is not null and event_name in ('game_started','daily_challenge_started') and created_at::date = now()::date
      and user_id not in (select id from public.profiles where role = 'admin')
    union all select 'active_7d', count(distinct user_id) from public.analytics_events
      where user_id is not null and event_name in ('game_started','daily_challenge_started') and created_at >= now() - interval '7 days'
      and user_id not in (select id from public.profiles where role = 'admin')
    union all select 'active_30d', count(distinct user_id) from public.analytics_events
      where user_id is not null and event_name in ('game_started','daily_challenge_started') and created_at >= now() - interval '30 days'
      and user_id not in (select id from public.profiles where role = 'admin')
    union all select 'rounds_total', coalesce(sum(rounds_played), 0) from public.profiles where role <> 'admin' or role is null
    union all select 'daily_assigned', count(*) from public.daily_challenge_assignments where event_id is not null
    union all select 'events_published', count(*) from public.events where published = true
    union all select 'events_hidden', count(*) from public.events where published = false
    union all select 'events_no_panorama', count(*) from public.events where panorama_url is null or panorama_url in ('', 'pending')
    union all select 'events_no_translation', count(*) from public.events where title_en is null or title_de is null;
end; $function$;
grant all on function public.report_overview() to authenticated;

create or replace function public.report_daily_series(p_days integer)
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
      (select count(*)::int from public.profiles p where p.created_at::date = d.d and (p.role <> 'admin' or p.role is null)),
      (select count(distinct ae.user_id)::int from public.analytics_events ae
         where ae.user_id is not null and ae.event_name in ('game_started','daily_challenge_started') and ae.created_at::date = d.d
         and ae.user_id not in (select id from public.profiles where role = 'admin')),
      (coalesce((select sum(jsonb_array_length(gs.rounds))::int from public.game_sessions gs
         where gs.finished_at::date = d.d and gs.user_id not in (select id from public.profiles where role = 'admin')), 0)
       + coalesce((select count(*)::int from public.daily_results dr
         where dr.date = d.d and dr.user_id not in (select id from public.profiles where role = 'admin')), 0)
       + coalesce((select count(*)::int from public.multiplayer_answers ma
         where ma.submitted_at::date = d.d and ma.user_id not in (select id from public.profiles where role = 'admin')), 0))
    from days d order by d.d;
end; $function$;
grant all on function public.report_daily_series(integer) to authenticated;

create or replace function public.report_daily_challenge(p_days integer)
returns table(day date, players integer, avg_score numeric)
language plpgsql security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    with days as (
      select generate_series(now()::date - (p_days - 1), now()::date, interval '1 day')::date as d
    )
    select d.d,
      (select count(*)::int from public.daily_results r where r.date = d.d and r.user_id not in (select id from public.profiles where role = 'admin')),
      (select round(avg(r.score)) from public.daily_results r where r.date = d.d and r.user_id not in (select id from public.profiles where role = 'admin'))
    from days d order by d.d;
end; $function$;
grant all on function public.report_daily_challenge(integer) to authenticated;

create or replace function public.report_campaigns_overview()
returns table(metric text, value numeric)
language plpgsql security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    with a as (select * from public.campaign_attempts where user_id not in (select id from public.profiles where role = 'admin'))
    select 'attempts'::text, count(*)::numeric from a
    union all select 'completions', count(*) from a where status = 'completed'
    union all select 'players', count(distinct user_id) from a
    union all select 'campaigns_played', count(distinct campaign_id) from a
    union all select 'perfect_runs', count(*) from a where status = 'completed' and stars >= 3;
end; $function$;
grant all on function public.report_campaigns_overview() to authenticated;

create or replace function public.report_campaigns()
returns table(campaign_id uuid, campaign text, category text, attempts bigint, completions bigint, players bigint, avg_stars numeric, avg_score numeric)
language plpgsql security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select c.id, c.title, coalesce(cc.title, '(bez kategorie)'),
      count(a.id)::bigint,
      count(a.id) filter (where a.status = 'completed')::bigint,
      count(distinct a.user_id)::bigint,
      round(avg(a.stars) filter (where a.status = 'completed'), 2),
      round(avg(a.total_score) filter (where a.status = 'completed'))
    from public.campaigns c
    left join public.campaign_attempts a
      on a.campaign_id = c.id and a.user_id not in (select id from public.profiles where role = 'admin')
    left join public.campaign_categories cc on cc.id = c.category_id
    group by c.id, c.title, cc.title
    order by count(a.id) filter (where a.status = 'completed') desc, count(a.id) desc, c.title;
end; $function$;
grant all on function public.report_campaigns() to authenticated;

create or replace function public.report_campaign_series(p_days integer)
returns table(day date, events integer, attempts integer, completions integer)
language plpgsql security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    with days as (
      select generate_series(now()::date - (p_days - 1), now()::date, interval '1 day')::date as d
    ), a as (
      select * from public.campaign_attempts where user_id not in (select id from public.profiles where role = 'admin')
    )
    select d.d,
      coalesce((select sum(coalesce(c.rounds_count, 5))::int from a join public.campaigns c on c.id = a.campaign_id where a.started_at::date = d.d), 0),
      coalesce((select count(*)::int from a where a.started_at::date = d.d), 0),
      coalesce((select count(*)::int from a where a.completed_at::date = d.d), 0)
    from days d order by d.d;
end; $function$;
grant all on function public.report_campaign_series(integer) to authenticated;

create or replace function public.report_page_views(p_days integer)
returns table(path text, views bigint, visitors bigint)
language plpgsql security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select coalesce(ae.properties->>'path', '(neznámá)') as path,
      count(*)::bigint as views,
      count(distinct ae.user_id)::bigint as visitors
    from public.analytics_events ae
    where ae.event_name = 'page_view'
      and ae.created_at >= now() - make_interval(days => p_days)
      and (ae.user_id is null or ae.user_id not in (select id from public.profiles where role = 'admin'))
    group by coalesce(ae.properties->>'path', '(neznámá)')
    order by count(*) desc
    limit 25;
end; $function$;
grant all on function public.report_page_views(integer) to authenticated;

create or replace function public.report_installs()
returns table(metric text, value numeric)
language plpgsql security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select 'installed_users'::text, count(distinct user_id)::numeric
      from public.analytics_events
      where event_name = 'app_installed' and user_id is not null
      and user_id not in (select id from public.profiles where role = 'admin')
    union all
    select 'registered', count(*)::numeric from public.profiles where role <> 'admin' or role is null;
end; $function$;
grant all on function public.report_installs() to authenticated;
