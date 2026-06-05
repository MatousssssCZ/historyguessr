-- HistoryGuessr · Migrace 011 · Zapnutí Realtime pro multiplayer
--
-- Problém: hostitel neviděl nově připojeného hráče, protože multiplayer
-- tabulky nebyly v Realtime publikaci `supabase_realtime`, takže klientům
-- nechodily postgres_changes události (INSERT/UPDATE/DELETE).
--
-- Tato migrace:
--   1) přidá tabulky do publikace supabase_realtime (idempotentně),
--   2) nastaví REPLICA IDENTITY FULL — nutné, aby u UPDATE/DELETE chodil
--      kompletní starý řádek a aby fungovalo RLS filtrování realtime streamu.
--
-- Spusť v Supabase SQL editoru. Lze spustit i opakovaně.

-- ── REPLICA IDENTITY FULL ─────────────────────────────────
alter table public.multiplayer_rooms   replica identity full;
alter table public.multiplayer_players  replica identity full;
alter table public.multiplayer_rounds   replica identity full;
alter table public.multiplayer_answers  replica identity full;

-- ── Přidání do realtime publikace (idempotentně) ──────────
do $$
begin
  -- multiplayer_rooms
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'multiplayer_rooms'
  ) then
    alter publication supabase_realtime add table public.multiplayer_rooms;
  end if;

  -- multiplayer_players
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'multiplayer_players'
  ) then
    alter publication supabase_realtime add table public.multiplayer_players;
  end if;

  -- multiplayer_rounds
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'multiplayer_rounds'
  ) then
    alter publication supabase_realtime add table public.multiplayer_rounds;
  end if;

  -- multiplayer_answers
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'multiplayer_answers'
  ) then
    alter publication supabase_realtime add table public.multiplayer_answers;
  end if;
end $$;
