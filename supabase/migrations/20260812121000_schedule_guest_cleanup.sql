-- ─────────────────────────────────────────────────────────────
-- Naplánování pravidelného úklidu neaktivních host účtů.
--
-- cleanup_stale_guests() (migrace 20260809161500) maže boty (bez jména >2 dny)
-- a nečinné hosty (>30 dní). Tady ho spustíme DENNĚ přes pg_cron, aby se
-- osiřelé host účty nehromadily a nezabíraly jména („Host####" kolize).
--
-- Idempotentní. Pokud pg_cron není dostupné (lokál), blok se přeskočí bez chyby.
-- Na produkci případně nejdřív povol rozšíření: Supabase → Database → Extensions
-- → pg_cron (nebo `create extension pg_cron;`) a spusť tuto migraci znovu.
-- ─────────────────────────────────────────────────────────────

do $$
begin
  -- Zkus povolit pg_cron (na některých prostředích jen přes dashboard).
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron nelze vytvořit zde (povol v Supabase dashboardu): %', sqlerrm;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'cleanup-stale-guests') then
      perform cron.unschedule('cleanup-stale-guests');
    end if;
    -- každý den ve 3:00 UTC
    perform cron.schedule('cleanup-stale-guests', '0 3 * * *',
      'select public.cleanup_stale_guests();');
    raise notice 'Úklid host účtů naplánován (denně 3:00 UTC).';
  else
    raise notice 'pg_cron není aktivní — úklid nenaplánován. Povol pg_cron a spusť migraci znovu.';
  end if;
end $$;
