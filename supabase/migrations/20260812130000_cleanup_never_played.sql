-- ─────────────────────────────────────────────────────────────
-- Zesílení úklidu host účtů (obrana proti botům bez captchy).
--
-- Hosté teď dostávají auto-jméno „Host####", takže staré pravidlo
-- „bez přezdívky >2 dny" už boty nechytá. Nové pravidlo: smaž hosty, kteří
-- si účet vytvořili, ale NIKDY NEHRÁLI (žádná hra ani denní výzva) a jsou
-- starší 3 dny. Plus dál nečinní >30 dní. Registrovaných se netýká.
-- Idempotentní.
-- ─────────────────────────────────────────────────────────────

create or replace function public.cleanup_stale_guests()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  deleted int;
begin
  with candidates as (
    select
      u.id,
      coalesce(p.is_anonymous, u.is_anonymous, false) as is_anon,
      u.created_at,
      exists (select 1 from public.game_sessions gs where gs.user_id = u.id) as played_solo,
      exists (select 1 from public.daily_results dr where dr.user_id = u.id) as played_daily,
      greatest(
        u.created_at,
        coalesce(u.last_sign_in_at, u.created_at),
        coalesce((select max(gs.finished_at) from public.game_sessions gs where gs.user_id = u.id), u.created_at),
        coalesce((select max(dr.created_at)  from public.daily_results dr where dr.user_id = u.id), u.created_at)
      ) as last_active
    from auth.users u
    join public.profiles p on p.id = u.id
  ),
  stale as (
    select id from candidates
    where is_anon = true
      and (
        -- nikdy nehrál a starší 3 dny (typicky bot / jen zkusil a nevrátil se)
        (not played_solo and not played_daily and created_at < now() - interval '3 days')
        -- nebo nečinný 30 dní
        or last_active < now() - interval '30 days'
      )
  ),
  del as (
    delete from auth.users where id in (select id from stale) returning id
  )
  select count(*) into deleted from del;
  return deleted;
end;
$$;

comment on function public.cleanup_stale_guests() is
  'Maže anonymní host účty: nehráli a starší 3 dny, nebo nečinní >30 dní. Vrací počet smazaných.';
