-- Naplánuj úklid multiplayer místností přes pg_cron, ať běží nezávisle na tom,
-- jestli někdo zrovna otevře MP lobby (dosud se maintain_multiplayer() volalo jen
-- z klienta, throttlované na 10 min/prohlížeč).
--
-- maintain_multiplayer() maže/uzavírá POUZE stagnující místnosti
-- (updated_at < 6 h → smazat, waiting < 1 h → finished, >24 h → smazat).
-- Aktivní hry mají čerstvý updated_at, takže se jich to netýká. Idempotentní.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'maintain-multiplayer') then
      perform cron.unschedule('maintain-multiplayer');
    end if;
    perform cron.schedule('maintain-multiplayer', '*/15 * * * *',
      'select public.maintain_multiplayer();');
  end if;
end $$;
