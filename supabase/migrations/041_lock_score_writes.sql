-- HistoryGuessr · Migrace 041 · Uzamčení přímých zápisů skóre/statistik
-- Spusť v Supabase → SQL Editor. Idempotentní.
--
-- ── PROBLÉM ──────────────────────────────────────────────────────────────
-- Skórování je server-authoritative (SECURITY DEFINER RPC nad
-- public.score_event_guess()), ale staré RLS politiky nechávaly otevřenou
-- přímou cestu přes veřejné PostgREST API s anon klíčem. Přihlášený uživatel
-- mohl RPC obejít a zapsat si LIBOVOLNÉ skóre / statistiky:
--   • daily_results  — insert own  → falešné skóre na denním žebříčku
--   • game_sessions  — update own  → total_score = 999999 bez přepočtu
--   • multiplayer_answers — insert/update own → cheat v živé hře (obchází 014)
--   • profiles       — update own hlídalo jen role, ne total_score/xp/games_played
--   • multiplayer_players — update own → přímá úprava total_score
--
-- ── ŘEŠENÍ ───────────────────────────────────────────────────────────────
-- RPC běží jako vlastník a obcházejí RLS i sloupcová práva, takže klientovi
-- ty přímé cesty prostě zavřeme. Legitimní klientské zápisy (založení session,
-- připojení do místnosti, změna username/avataru) zůstávají funkční.

-- ── profiles: jen username/avatar_url smí měnit klient ───────────────────
-- Skóre/XP/statistiky zapisují jen SECURITY DEFINER funkce (add_xp,
-- increment_user_score, submit_* …). Sloupcová práva to vynutí i kdyby RLS
-- politika prošla.
revoke update on public.profiles from authenticated;
grant  update (username, avatar_url) on public.profiles to authenticated;

-- ── game_sessions: klient smí jen ZALOŽIT prázdnou session ───────────────
-- Dokončení (rounds, total_score, finished_at) dělá výhradně submit_game_session.
drop policy if exists "sessions: update own" on public.game_sessions;

drop policy if exists "sessions: insert own" on public.game_sessions;
create policy "sessions: insert own"
  on public.game_sessions for insert
  with check (
    auth.uid() = user_id
    and total_score is null      -- nesmí se založit s předvyplněným skóre
    and finished_at is null      -- ani jako už „dohraná"
  );

-- ── daily_results: zápis jen přes submit_daily_result ────────────────────
-- Public select zůstává (žebříček), přímý insert rušíme.
drop policy if exists "daily_results: insert own" on public.daily_results;

-- ── multiplayer_answers: zápis jen přes submit_multiplayer_answer (014) ──
drop policy if exists "answers: insert own" on public.multiplayer_answers;
drop policy if exists "answers: update own" on public.multiplayer_answers;

-- ── multiplayer_players: total_score aktualizuje jen RPC ─────────────────
-- Insert (připojení do místnosti) zůstává; přímý update rušíme.
drop policy if exists "players: update own" on public.multiplayer_players;
