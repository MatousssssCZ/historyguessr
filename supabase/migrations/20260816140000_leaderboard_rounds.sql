-- Žebříček ukazuje počet odehraných KOL (ne her). Kola dopočítáme:
-- game_sessions (sólo+kampaň) přes délku rounds jsonb + denní výzvy + MP odpovědi.
-- Mění se návratový sloupec (games_played → rounds_played) → nutný DROP.

drop function if exists public.global_leaderboard(int);
drop function if exists public.world_leaderboard_slice(int);

create function public.global_leaderboard(p_limit int default 50)
returns table(rank int, user_id uuid, username text, xp bigint, total_score bigint, rounds_played int)
language sql
security definer
stable
set search_path = public
as $$
  select (row_number() over (order by pr.total_score desc, pr.xp desc))::int as rank,
         pr.id, pr.username, pr.xp, pr.total_score,
         (coalesce((select sum(jsonb_array_length(gs.rounds)) from public.game_sessions gs where gs.user_id = pr.id), 0)
          + coalesce((select count(*) from public.daily_results dr where dr.user_id = pr.id), 0)
          + coalesce((select count(*) from public.multiplayer_answers ma where ma.user_id = pr.id), 0))::int as rounds_played
    from public.profiles pr
   where pr.games_played > 0 and pr.username is not null
   order by pr.total_score desc, pr.xp desc
   limit greatest(1, least(p_limit, 200));
$$;

create function public.world_leaderboard_slice(p_radius int default 3)
returns table(rank int, user_id uuid, username text, xp bigint, total_score bigint, rounds_played int)
language sql
security definer
stable
set search_path = public
as $$
  with ranked as (
    select (row_number() over (order by pr.total_score desc, pr.xp desc))::int as rank,
           pr.id, pr.username, pr.xp, pr.total_score,
           (coalesce((select sum(jsonb_array_length(gs.rounds)) from public.game_sessions gs where gs.user_id = pr.id), 0)
            + coalesce((select count(*) from public.daily_results dr where dr.user_id = pr.id), 0)
            + coalesce((select count(*) from public.multiplayer_answers ma where ma.user_id = pr.id), 0))::int as rounds_played
      from public.profiles pr
     where pr.games_played > 0 and pr.username is not null
  ),
  me as (select rank from ranked where id = auth.uid())
  select r.rank, r.id, r.username, r.xp, r.total_score, r.rounds_played
    from ranked r, me
   where r.rank between me.rank - greatest(0, p_radius) and me.rank + greatest(0, p_radius)
   order by r.rank;
$$;

revoke all on function public.global_leaderboard(int) from public;
revoke all on function public.world_leaderboard_slice(int) from public;
grant execute on function public.global_leaderboard(int) to authenticated;
grant execute on function public.world_leaderboard_slice(int) to authenticated;
