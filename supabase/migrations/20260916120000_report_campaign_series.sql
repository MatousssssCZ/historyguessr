-- Denní vývoj hraní kampaní: počet odehraných UDÁLOSTÍ (pokus × počet kol kampaně),
-- počet pokusů a dokončení. Zdroj = campaign_attempts. Admin only. Idempotentní.
create or replace function public.report_campaign_series(p_days integer)
  returns table(day date, events integer, attempts integer, completions integer)
  language plpgsql security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    with days as (
      select generate_series(now()::date - (p_days - 1), now()::date, interval '1 day')::date as d
    )
    select d.d,
      coalesce((
        select sum(coalesce(c.rounds_count, 5))::int
        from public.campaign_attempts a
        join public.campaigns c on c.id = a.campaign_id
        where a.started_at::date = d.d
      ), 0),
      coalesce((select count(*)::int from public.campaign_attempts a where a.started_at::date = d.d), 0),
      coalesce((select count(*)::int from public.campaign_attempts a where a.completed_at::date = d.d), 0)
    from days d order by d.d;
end; $function$;
grant all on function public.report_campaign_series(integer) to authenticated;
