-- HistoryGuessr · Migrace 018 · RPC pro skóre/počet her hráče
--
-- addScoreToProfile() volala increment_user_score(), která ale nikdy nebyla
-- v migracích → tiše selhávala a profiles.total_score / games_played se po
-- dohrané sólo hře nezvyšovaly (menu i statistiky ukazovaly 0).
--
-- Spusť v Supabase SQL editoru. Idempotentní.

create or replace function public.increment_user_score(
  p_user_id uuid,
  p_score int
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set total_score  = coalesce(total_score, 0)  + p_score,
         games_played = coalesce(games_played, 0) + 1
   where id = p_user_id;
$$;

grant execute on function public.increment_user_score(uuid, int) to authenticated;

-- Pojistka: oprávnění na game_sessions (statistiky čtou odsud)
grant select, insert, update on public.game_sessions to authenticated;
