-- 1) Kteří moji přátelé mají zapnuté notifikace (= mají aspoň jeden push odběr).
--    Používá se v „Ještě nehráli", aby šel posel poslat jen tomu, komu reálně dorazí
--    (nainstalovaná appka + povolené notifikace).
create or replace function public.friends_push_enabled()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct f.f_id
  from (
    select case when fr.requester_id = auth.uid() then fr.addressee_id else fr.requester_id end as f_id
    from public.friendships fr
    where (fr.requester_id = auth.uid() or fr.addressee_id = auth.uid()) and fr.status = 'accepted'
  ) f
  where exists (select 1 from public.push_subscriptions ps where ps.user_id = f.f_id);
$$;
grant execute on function public.friends_push_enabled() to authenticated;

-- 2) Reporting: přidá metriku „push_enabled_users" (kolik hráčů má zapnuté notifikace).
--    Rozšiřuje report_installs; bezpečné i když push_subscriptions ještě neexistuje.
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
    select 'push_enabled_users', v_push;
end; $function$;
grant all on function public.report_installs() to authenticated;
