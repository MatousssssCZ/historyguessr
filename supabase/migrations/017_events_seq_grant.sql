-- HistoryGuessr · Migrace 017 · Oprávnění na sekvenci events_seq_seq
--
-- Insert do events selhával s "permission denied for sequence events_seq_seq"
-- (42501): sloupec `seq` má default nextval('events_seq_seq') (migrace 010),
-- ale role `authenticated` neměla na sekvenci USAGE → admin nemohl založit
-- událost.
--
-- Spusť v Supabase SQL editoru. Idempotentní.

grant usage, select on sequence public.events_seq_seq to authenticated;
