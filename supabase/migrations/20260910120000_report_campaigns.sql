-- Reporting kampaní: kolik se hrají. Zdroj = campaign_attempts (jeden pokus = jedno odehrání).

-- Přehledové KPI (metric/value, jako report_overview).
create or replace function public.report_campaigns_overview()
  returns table(metric text, value numeric)
  language plpgsql security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select 'attempts'::text,   count(*)::numeric from public.campaign_attempts
    union all select 'completions',  count(*) from public.campaign_attempts where status = 'completed'
    union all select 'players',      count(distinct user_id) from public.campaign_attempts
    union all select 'campaigns_played', count(distinct campaign_id) from public.campaign_attempts
    union all select 'perfect_runs', count(*) from public.campaign_attempts where status = 'completed' and stars >= 3;
end; $function$;
grant all on function public.report_campaigns_overview() to authenticated;

-- Statistika po kampaních — seřazeno dle počtu dokončení.
create or replace function public.report_campaigns()
  returns table(
    campaign_id uuid,
    campaign    text,
    category    text,
    attempts    bigint,
    completions bigint,
    players     bigint,
    avg_stars   numeric,
    avg_score   numeric
  )
  language plpgsql security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select
      c.id,
      c.title,
      coalesce(cc.title, '(bez kategorie)'),
      count(a.id)::bigint,
      count(a.id) filter (where a.status = 'completed')::bigint,
      count(distinct a.user_id)::bigint,
      round(avg(a.stars) filter (where a.status = 'completed'), 2),
      round(avg(a.total_score) filter (where a.status = 'completed'))
    from public.campaigns c
    left join public.campaign_attempts a on a.campaign_id = c.id
    left join public.campaign_categories cc on cc.id = c.category_id
    group by c.id, c.title, cc.title
    order by count(a.id) filter (where a.status = 'completed') desc, count(a.id) desc, c.title;
end; $function$;
grant all on function public.report_campaigns() to authenticated;
