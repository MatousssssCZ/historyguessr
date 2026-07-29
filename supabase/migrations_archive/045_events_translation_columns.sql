-- HistoryGuessr · Migrace 045 · Překladové sloupce událostí (EN/DE)
--
-- Tyto sloupce byly na produkci přidány RUČNÍM `ALTER` mimo migrační soubory,
-- takže lokální DB postavená jen z migrací je neměla → appka padala při čtení
-- title_en/description_en (eventLocale.ts). Tato migrace je doplňuje.
--
-- Idempotentní: na produkci je no-op (sloupce už existují), lokálně je vytvoří.
-- Spusť v Supabase SQL editoru (na prod) / aplikuje se přes `supabase db reset` (lokálně).

alter table public.events add column if not exists title_en       text;
alter table public.events add column if not exists title_de       text;
alter table public.events add column if not exists description_en text;
alter table public.events add column if not exists description_de text;
