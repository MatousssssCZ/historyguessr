-- HistoryGuessr · Migrace 044 · Plně autonomní úklid multiplayeru (pg_cron)
--
-- Do teď se úklid spouštěl klientsky při otevření MP lobby (migrace 038–040).
-- To stačí, dokud MP někdo používá — ale opuštěné místnosti čekají do dalšího
-- návštěvníka. Tahle migrace zapne pg_cron, takže maintain_multiplayer() běží
-- každých 15 minut SÁM, nezávisle na tom, jestli je někdo online.
--
-- ⚠ PŘEDPOKLAD: rozšíření pg_cron musí být povolené v projektu.
--   Supabase Dashboard → Database → Extensions → vyhledej „pg_cron" → Enable.
--   (Alternativně to zkusí i `create extension` níže — na některých plánech
--    ale vyžaduje povolení přes dashboard, proto ten krok udělej napřed.)
--
-- Spusť v Supabase SQL editoru. Idempotentní. Navazuje na 040.

-- ── 1) Zapni rozšíření (no-op, když už je) ────────────────
create extension if not exists pg_cron;

-- ── 2) Naplánuj úklid každých 15 minut ────────────────────
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
    raise notice 'pg_cron: naplánováno maintain_multiplayer_15min (*/15 * * * *)';
  else
    raise warning 'pg_cron NENÍ zapnutý — zapni ho v Dashboard → Database → Extensions a spusť tuto migraci znovu. Do té doby běží jen klientský úklid (038–040).';
  end if;
end $$;

-- ── Ověření ───────────────────────────────────────────────
--   Je pg_cron zapnutý:     select * from pg_extension where extname = 'pg_cron';
--   Běžící joby:            select jobname, schedule, active from cron.job;
--   Historie posledních běhů:
--     select jobid, status, return_message, start_time
--       from cron.job_run_details
--      order by start_time desc limit 10;
--   Ruční spuštění:         select public.maintain_multiplayer();
