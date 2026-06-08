-- HistoryGuessr · Migrace 015 · Přesné datum události (pro denní výzvu)
--
-- Volitelné přesné datum (YYYY-MM-DD). Den + měsíc se používá jako návrh
-- pro „Tento den v historii" v admin kalendáři denních výzev.
--
-- Spusť v Supabase SQL editoru. Idempotentní.

alter table public.events
  add column if not exists event_date date;
