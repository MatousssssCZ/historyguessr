-- „Průměr na kolo" počítat ze SUROVÝCH skóre za kolo (0–1000), ne z total_score.
-- total_score neobsahuje denní/MP a naopak rounds_played je obsahuje → dřív se
-- populace míchaly. Násobič denní výzvy jde jen do XP, ne do skóre — surová
-- kolová skóre jsou tedy čistá. Přidáváme sum_round_score → DROP nutný.

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
         -- počet kol napříč režimy
         (coalesce((select sum(jsonb_array_length(gs.rounds)) from public.game_sessions gs where gs.user_id = pr.id), 0)
          + coalesce((select count(*) from public.daily_results dr where dr.user_id = pr.id), 0)
          + coalesce((select count(*) from public.multiplayer_answers ma where ma.user_id = pr.id), 0))::int as rounds_played,
         -- součet SUROVÝCH skóre za kolo (bez XP násobiče) ze stejných zdrojů
         (coalesce((select sum((r->>'round_score')::int) from public.game_sessions gs, jsonb_array_elements(gs.rounds) r where gs.user_id = pr.id), 0)
          + coalesce((select sum(dr.score) from public.daily_results dr where dr.user_id = pr.id), 0)
          + coalesce((select sum(ma.round_score) from public.multiplayer_answers ma where ma.user_id = pr.id), 0))::bigint as sum_round_score,
         pr.created_at,
         (select count(*) + 1 from pop p
            where p.total_score > coalesce((select total_score from tgt), -1)
               or (p.total_score = (select total_score from tgt) and p.xp > (select xp from tgt)))::int as world_rank
    from public.profiles pr
   where pr.id = p_user_id;
$$;

revoke all on function public.public_profile(uuid) from public;
grant execute on function public.public_profile(uuid) to authenticated;
