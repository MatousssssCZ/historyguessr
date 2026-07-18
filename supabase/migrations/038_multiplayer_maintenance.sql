-- HistoryGuessr · Migrace 038 · Spolehlivý úklid multiplayeru (bez závislosti na cronu)
--
-- Problém: cron joby z migrací 013 a 027 jsou obalené v
--   `if exists (pg_cron) then ...`. Když pg_cron NENÍ zapnutý (výchozí stav),
--   blok tiše nic neudělá → místnosti se nikdy neuklidí, DB bobtná.
--
-- Řešení: úklid se dá spustit i z klienta (throttlovaně při otevření MP lobby).
--   K tomu potřebují funkce grant pro roli authenticated.
--   Cron zůstává jako bonus, když ho někdy zapneš.
--
-- Tato migrace je SOBĚSTAČNÁ: vytvoří si i podfunkce z 013/027 (create or replace),
-- takže funguje i bez jejich předchozího spuštění.
--
-- Spusť v Supabase SQL editoru. Idempotentní.

-- ── Podfunkce (shodné s 013/027, pro jistotu znovu) ───────

-- Smaž vše starší než 6 hodin (dohrané, opuštěné i zapomenutá „waiting" lobby)
create or replace function public.cleanup_multiplayer()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ids uuid[];
begin
  select array_agg(id) into ids
    from public.multiplayer_rooms
   where updated_at < now() - interval '6 hours';
  if ids is null then return; end if;

  delete from public.multiplayer_answers where room_id = any(ids);
  delete from public.multiplayer_rounds  where room_id = any(ids);
  delete from public.multiplayer_players where room_id = any(ids);
  delete from public.multiplayer_rooms   where id = any(ids);
end;
$$;

-- Zavři neaktivní čekárny (status 'waiting' > 1 h)
create or replace function public.close_inactive_lobbies()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.multiplayer_rooms
     set status = 'finished', updated_at = now()
   where status = 'waiting'
     and updated_at < now() - interval '1 hour';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ── Kombinovaný krok pro klienta ──────────────────────────
create or replace function public.maintain_multiplayer()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  n := public.close_inactive_lobbies();  -- 'waiting' > 1 h → 'finished'
  perform public.cleanup_multiplayer();  -- cokoli > 6 h → smazat
  return n;
end;
$$;

-- ── Granty (funkce teď zaručeně existují) ─────────────────
grant execute on function public.cleanup_multiplayer()    to authenticated;
grant execute on function public.close_inactive_lobbies() to authenticated;
grant execute on function public.maintain_multiplayer()   to authenticated;

-- ── Naplánování přes pg_cron (když je zapnutý) ────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'maintain_multiplayer_15min') then
      perform cron.unschedule('maintain_multiplayer_15min');
    end if;
    perform cron.schedule(
      'maintain_multiplayer_15min',
      '*/15 * * * *',
      $cron$ select public.maintain_multiplayer(); $cron$
    );
  end if;
end $$;

-- ── DIAGNOSTIKA (spouštěj SAMOSTATNĚ, ne jako součást migrace) ──
--   Ruční spuštění:                 select public.maintain_multiplayer();
--   Kolik starých místností zbývá:  select count(*) from public.multiplayer_rooms where updated_at < now() - interval '6 hours';
--   Je pg_cron zapnutý:             select * from pg_extension where extname = 'pg_cron';
--   Běžící cron joby:               select jobname, schedule, active from cron.job;
