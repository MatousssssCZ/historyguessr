-- Kolik hráčů si appku uložilo na plochu (PWA) — počítá unikátní uživatele,
-- kteří appku spustili jako nainstalovanou (událost 'app_installed'). Admin only.
create or replace function public.report_installs()
  returns table(metric text, value numeric)
  language plpgsql security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select 'installed_users'::text,
      count(distinct user_id)::numeric
      from public.analytics_events
      where event_name = 'app_installed' and user_id is not null
    union all
    select 'registered', count(*)::numeric from public.profiles;
end; $function$;
grant all on function public.report_installs() to authenticated;
