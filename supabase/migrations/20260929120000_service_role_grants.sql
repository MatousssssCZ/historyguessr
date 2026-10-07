-- service_role (server/Edge/cron) obchází RLS, ale potřebuje běžné SQL GRANTy
-- na tabulky vytvořené migracemi. Bez nich padá `/api/send-messenger` a cron
-- s chybou 42501 „permission denied for table …".
grant select, insert, update, delete on public.messenger_nudges   to service_role;
grant select, insert, update, delete on public.push_subscriptions to service_role;
grant select, insert, update, delete on public.daily_reminder_log  to service_role;
