-- Lokalizace relikvií: EN/DE název a popis (fallback na český). Idempotentní.
alter table public.relics
  add column if not exists name_en        text,
  add column if not exists name_de        text,
  add column if not exists description_en text,
  add column if not exists description_de text;
