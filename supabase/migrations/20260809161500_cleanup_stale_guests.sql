-- ─────────────────────────────────────────────────────────────
-- Úklid anonymních (host) účtů + obrana proti spamu
--
-- Anonymní přihlášení je levný cíl botů: tisíce účtů zabírají MAU
-- kvótu, plní databázi a rezervují přezdívky. Tahle migrace:
--   1) maže „boty" — anonymy, kteří si NIKDY nenastavili přezdívku
--      (nikdy nezačali hrát) a jsou starší než 2 dny  → rychlá obrana
--   2) maže NEČINNÉ hosty — anonymy bez aktivity 30 dní  → uvolní jména
--
-- Registrovaných účtů (is_anonymous = false) se NIKDY nedotkne.
-- Smazání z auth.users kaskádově smaže profil i všechna herní data.
-- Idempotentní — lze pustit opakovaně.
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
      p.username,
      u.created_at,
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
        -- 1) bot / nikdy nezačal hrát (bez přezdívky) starší 2 dny
        (username is null and created_at < now() - interval '2 days')
        -- 2) nečinný host — žádná aktivita 30 dní
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

-- Jen pro servis/cron — běžný uživatel tuhle funkci volat nesmí.
revoke all on function public.cleanup_stale_guests() from public, anon, authenticated;
grant execute on function public.cleanup_stale_guests() to service_role;

comment on function public.cleanup_stale_guests() is
  'Maže anonymní host účty: boty bez přezdívky (>2 dny) a nečinné hosty (>30 dní). Vrací počet smazaných.';

-- ── Automatické spouštění přes pg_cron (pokud je rozšíření dostupné) ──
-- Když pg_cron není (lokál / některé plány), tenhle blok se přeskočí
-- a funkci lze volat ručně:  select public.cleanup_stale_guests();
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- odstraň případný starý job se stejným názvem
    if exists (select 1 from cron.job where jobname = 'cleanup-stale-guests') then
      perform cron.unschedule('cleanup-stale-guests');
    end if;
    -- každý den ve 3:00 UTC
    perform cron.schedule('cleanup-stale-guests', '0 3 * * *',
      'select public.cleanup_stale_guests();');
  end if;
end $$;
