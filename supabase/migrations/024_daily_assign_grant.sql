-- HistoryGuessr · Migrace 024 · Oprávnění pro zápis denních přiřazení
--
-- RLS politiky (006) existují, ale roli `authenticated` chyběla základní
-- tabulková oprávnění → upsert/delete padal na "permission denied (42501)".
-- RLS i tak rozhoduje, KDO smí zapsat (jen admin přes is_admin()).
--
-- Spusť v Supabase SQL editoru. Idempotentní.

grant select, insert, update, delete on public.daily_challenge_assignments to authenticated;
