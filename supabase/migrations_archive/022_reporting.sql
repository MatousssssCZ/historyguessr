-- HistoryGuessr · Migrace 022 · Reporting pro admina
--
-- Sada SECURITY DEFINER RPC, které vrací agregáty. Každá ověří is_admin(),
-- takže přes ně data čte jen admin (RPC jinak RLS obchází).
--
-- Spusť v Supabase SQL editoru. Idempotentní.

-- ── Souhrnné KPI ──────────────────────────────────────────
create or replace function public.report_overview()
returns table(metric text, value numeric)
language plpgsql security definer set search_path = public as $$
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
    union all select 'games_total', count(*) from public.analytics_events where event_name in ('game_completed','daily_challenge_completed')
    union all select 'daily_assigned', count(*) from public.daily_challenge_assignments where event_id is not null
    union all select 'events_published', count(*) from public.events where published = true
    union all select 'events_hidden', count(*) from public.events where published = false
    union all select 'events_no_panorama', count(*) from public.events where panorama_url is null or panorama_url in ('', 'pending')
    union all select 'events_no_translation', count(*) from public.events where title_en is null or title_de is null;
end; $$;

-- ── Časová řada: noví uživatelé / aktivní / hry za den ────
create or replace function public.report_daily_series(p_days int)
returns table(day date, new_users int, active_users int, games int)
language plpgsql security definer set search_path = public as $$
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
      (select count(*)::int from public.analytics_events ae
         where ae.event_name in ('game_completed','daily_challenge_completed') and ae.created_at::date = d.d)
    from days d order by d.d;
end; $$;

-- ── Hry po kategoriích (součet play_count) ────────────────
create or replace function public.report_categories()
returns table(category text, plays bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select coalesce(e.category, '(bez kategorie)'), coalesce(sum(e.play_count), 0)::bigint
      from public.events e group by e.category order by 2 desc;
end; $$;

-- ── Pořadí událostí podle počtu odehrání ──────────────────
create or replace function public.report_events_ranked()
returns table(id uuid, title text, category text, play_count int)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select e.id, e.title, e.category, e.play_count
      from public.events e where e.published = true
      order by e.play_count desc limit 300;
end; $$;

-- ── Denní výzva: účast + průměr za den ────────────────────
create or replace function public.report_daily_challenge(p_days int)
returns table(day date, players int, avg_score numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    with days as (
      select generate_series(now()::date - (p_days - 1), now()::date, interval '1 day')::date as d
    )
    select d.d,
      (select count(*)::int from public.daily_results r where r.date = d.d),
      (select round(avg(r.score)) from public.daily_results r where r.date = d.d)
    from days d order by d.d;
end; $$;

-- ── Multiplayer souhrn ────────────────────────────────────
create or replace function public.report_multiplayer()
returns table(metric text, value numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select 'rooms_total'::text, count(*)::numeric from public.multiplayer_rooms
    union all select 'rooms_finished', count(*) from public.multiplayer_rooms where status = 'finished'
    union all select 'mode_classic', count(*) from public.multiplayer_rooms where coalesce(settings->>'mode','classic') = 'classic'
    union all select 'mode_br', count(*) from public.multiplayer_rooms where settings->>'mode' = 'battle_royale'
    union all select 'avg_players', coalesce(round(avg(cnt), 1), 0) from (
      select count(*) cnt from public.multiplayer_players group by room_id
    ) s;
end; $$;

grant execute on function public.report_overview()             to authenticated;
grant execute on function public.report_daily_series(int)      to authenticated;
grant execute on function public.report_categories()           to authenticated;
grant execute on function public.report_events_ranked()        to authenticated;
grant execute on function public.report_daily_challenge(int)   to authenticated;
grant execute on function public.report_multiplayer()          to authenticated;
