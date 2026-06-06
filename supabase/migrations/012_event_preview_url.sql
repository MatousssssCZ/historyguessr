-- HistoryGuessr · Migrace 012 · Náhled panoramatu (preview)
--
-- Malý náhledový obrázek (1024×512 WebP, ~30–60 kB) se ukládá do bucketu
-- `panorama` jako `${eventId}/preview.webp`. Pannellum ho zobrazí okamžitě,
-- než dotáhne plnou panoramu → hráč nevidí prázdnou obrazovku.
--
-- Spusť v Supabase SQL editoru. Idempotentní.

alter table public.events
  add column if not exists preview_url text;
