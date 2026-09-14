-- Naplánování večerní připomínky přes pg_cron + pg_net.
-- Spusť JEDNOU v Supabase SQL editoru (vyžaduje rozšíření pg_cron a pg_net —
-- zapni je v Database → Extensions, pokud ještě nejsou).
--
-- ⚠ Doplň <PROJECT_REF> a <SERVICE_ROLE_KEY>. Čas je v UTC:
--    17:00 UTC ≈ 19:00 léto / 18:00 zima v ČR. Uprav dle potřeby.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'daily-reminders',
  '0 17 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/send-daily-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Zrušení (kdyby bylo potřeba):
-- select cron.unschedule('daily-reminders');
