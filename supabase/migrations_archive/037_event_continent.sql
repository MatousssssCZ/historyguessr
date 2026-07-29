-- HistoryGuessr · Migrace 037 · Kontinent události (odvozený z GPS)
--
-- Zadání (bod 12): kontinent přidat POUZE pokud jde spolehlivě odvodit z GPS,
-- které událost už má. Nevyžadovat ruční doplňování ke každé události.
--
-- Tady jen datový model + cache. Výpočet dělá klient offline (lib/continent.ts)
-- v dávce z adminu — žádná placená služba při načtení. Uloží se sem s příznakem
-- zdroje (auto/manual). Admin může výjimečně opravit ručně.
--
-- Konzistentní hodnoty: Europe, Asia, Africa, North America, South America,
--                       Oceania, Antarctica.
--
-- Spusť v Supabase SQL editoru. Idempotentní.

alter table public.events add column if not exists continent text
  check (continent is null or continent in
    ('Europe','Asia','Africa','North America','South America','Oceania','Antarctica'));

alter table public.events add column if not exists continent_source text
  not null default 'auto'
  check (continent_source in ('auto','manual'));

alter table public.events add column if not exists continent_computed_at timestamptz;

-- Filtr Single Playeru podle kontinentu se opře o tenhle index
create index if not exists idx_events_continent on public.events(continent)
  where continent is not null;
