-- Reporting: nejčastěji zobrazované stránky (v aplikaci) za posledních N dní.
-- Zdroj = analytics_events s event_name = 'page_view' a properties.path.
create or replace function public.report_page_views(p_days integer)
  returns table(path text, views bigint, visitors bigint)
  language plpgsql security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select
      coalesce(ae.properties->>'path', '(neznámá)') as path,
      count(*)::bigint as views,
      count(distinct ae.user_id)::bigint as visitors
    from public.analytics_events ae
    where ae.event_name = 'page_view'
      and ae.created_at >= now() - make_interval(days => p_days)
    group by coalesce(ae.properties->>'path', '(neznámá)')
    order by count(*) desc
    limit 25;
end; $function$;
grant all on function public.report_page_views(integer) to authenticated;
