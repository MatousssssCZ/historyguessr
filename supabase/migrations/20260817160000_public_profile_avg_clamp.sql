-- Průměr na kolo: ořezat každé kolo na platný rozsah [0, 1000]. Historicky se
-- v datech objevují nafouklá kolová skóre (starší denní výsledky se skóre ×
-- XP násobič, případně jiné). Legitimní kolo = loc(≤500) + rok(≤500) ≤ 1000,
-- takže clamp jen očistí vadné hodnoty a zaručí, že průměr nikdy nepřekročí 1000.

drop function if exists public.public_profile(uuid);

create function public.public_profile(p_user_id uuid)
returns table(username text, xp bigint, total_score bigint, games_played int, rounds_played int, sum_round_score bigint, created_at timestamptz, world_rank int)
language sql
security definer
stable
set search_path = public
as $$
  with pop as (
    select id, total_score, xp from public.profiles
     where games_played > 0 and username is not null
  ),
  tgt as (select total_score, xp from pop where id = p_user_id)
  select pr.username, pr.xp, pr.total_score, pr.games_played,
         (coalesce((select sum(jsonb_array_length(gs.rounds)) from public.game_sessions gs where gs.user_id = pr.id), 0)
          + coalesce((select count(*) from public.daily_results dr where dr.user_id = pr.id), 0)
          + coalesce((select count(*) from public.multiplayer_answers ma where ma.user_id = pr.id), 0))::int as rounds_played,
         -- součet SUROVÝCH skóre za kolo, každé ořezané na [0, 1000]
         (coalesce((select sum(least(greatest((r->>'round_score')::int, 0), 1000)) from public.game_sessions gs, jsonb_array_elements(gs.rounds) r where gs.user_id = pr.id), 0)
          + coalesce((select sum(least(greatest(dr.score, 0), 1000)) from public.daily_results dr where dr.user_id = pr.id), 0)
          + coalesce((select sum(least(greatest(ma.round_score, 0), 1000)) from public.multiplayer_answers ma where ma.user_id = pr.id), 0))::bigint as sum_round_score,
         pr.created_at,
         (select count(*) + 1 from pop p
            where p.total_score > coalesce((select total_score from tgt), -1)
               or (p.total_score = (select total_score from tgt) and p.xp > (select xp from tgt)))::int as world_rank
    from public.profiles pr
   where pr.id = p_user_id;
$$;

revoke all on function public.public_profile(uuid) from public;
grant execute on function public.public_profile(uuid) to authenticated;
