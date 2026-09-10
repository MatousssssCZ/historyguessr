-- Silueta relikvie pro „ražený" kovový odznak (profil, žebříček, karty).
-- PNG s průhledností; UI ji obarví kovovým tónem dle vzácnosti. Idempotentní.
alter table public.relics add column if not exists silhouette_url text;
