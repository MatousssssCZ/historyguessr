-- Reporting: počet kliknutí na „Kup mi kávu" (Ko-fi). Počítá VŠECHNA kliknutí
-- (analytics událost 'coffee_clicked'), ne unikátní uživatele.
create or replace function public.report_installs()
  returns table(metric text, value numeric)
  language plpgsql security definer set search_path = public
as $function$
declare v_push numeric := 0;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if to_regclass('public.push_subscriptions') is not null then
    select count(distinct user_id)::numeric into v_push from public.push_subscriptions;
  end if;
  return query
    select 'installed_users'::text,
      count(distinct user_id)::numeric
      from public.analytics_events
      where event_name = 'app_installed' and user_id is not null
    union all
    select 'registered', count(*)::numeric from public.profiles
    union all
    select 'push_enabled_users', v_push
    union all
    select 'coffee_clicks', count(*)::numeric
      from public.analytics_events where event_name = 'coffee_clicked';
end; $function$;
grant all on function public.report_installs() to authenticated;
