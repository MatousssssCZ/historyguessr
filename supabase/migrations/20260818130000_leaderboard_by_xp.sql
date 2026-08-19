-- Žebříček i „Pořadí ve světě" řadit podle XP (zkušeností), tiebreak total_score.
-- public_profile nově čte rounds_played ze sloupce a pořadí počítá dle XP.

create or replace function public.global_leaderboard(p_limit int default 50)
returns table(rank int, user_id uuid, username text, xp bigint, total_score bigint, rounds_played int)
language sql security definer stable set search_path = public
as $$
  select (row_number() over (order by pr.xp desc, pr.total_score desc))::int as rank,
         pr.id, pr.username, pr.xp, pr.total_score, pr.rounds_played
    from public.profiles pr
   where pr.games_played > 0 and pr.username is not null
   order by pr.xp desc, pr.total_score desc
   limit greatest(1, least(p_limit, 200));
$$;

create or replace function public.world_leaderboard_slice(p_radius int default 3)
returns table(rank int, user_id uuid, username text, xp bigint, total_score bigint, rounds_played int)
language sql security definer stable set search_path = public
as $$
  with ranked as (
    select (row_number() over (order by pr.xp desc, pr.total_score desc))::int as rank,
           pr.id, pr.username, pr.xp, pr.total_score, pr.rounds_played
      from public.profiles pr
     where pr.games_played > 0 and pr.username is not null
  ),
  me as (select rank from ranked where id = auth.uid())
  select r.rank, r.id, r.username, r.xp, r.total_score, r.rounds_played
    from ranked r, me
   where r.rank between me.rank - greatest(0, p_radius) and me.rank + greatest(0, p_radius)
   order by r.rank;
$$;

create or replace function public.friends_leaderboard()
returns table(rank int, user_id uuid, username text, xp bigint, total_score bigint)
language sql security definer stable set search_path = public
as $$
  with me_and_friends as (
    select auth.uid() as id
    union
    select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
      from public.friendships f
     where (f.requester_id = auth.uid() or f.addressee_id = auth.uid()) and f.status = 'accepted'
  )
  select (row_number() over (order by pr.xp desc, pr.total_score desc))::int as rank,
         pr.id, pr.username, pr.xp, pr.total_score
    from me_and_friends m
    join public.profiles pr on pr.id = m.id
   order by pr.xp desc, pr.total_score desc;
$$;

-- „Pořadí ve světě" dle XP (tiebreak total_score), stejná populace jako žebříček.
create or replace function public.get_world_rank()
returns table(rank bigint, total bigint)
language sql security definer stable set search_path = public
as $$
  with pop as (select id, total_score, xp from public.profiles where games_played > 0 and username is not null),
  me as (select total_score, xp from pop where id = auth.uid())
  select
    (select count(*) + 1 from pop p
       where p.xp > coalesce((select xp from me), -1)
          or (p.xp = (select xp from me) and p.total_score > (select total_score from me))
    )::bigint as rank,
    (select count(*) from pop)::bigint as total;
$$;

-- Veřejný profil: rounds_played ze sloupce, pořadí dle XP.
drop function if exists public.public_profile(uuid);
create function public.public_profile(p_user_id uuid)
returns table(username text, xp bigint, total_score bigint, games_played int, rounds_played int, sum_round_score bigint, streak int, created_at timestamptz, world_rank int)
language sql security definer stable set search_path = public
as $$
  with pop as (select id, total_score, xp from public.profiles where games_played > 0 and username is not null),
  tgt as (select total_score, xp from pop where id = p_user_id)
  select pr.username, pr.xp, pr.total_score, pr.games_played, pr.rounds_played,
         (coalesce((select sum(least(greatest((r->>'round_score')::int, 0), 1000)) from public.game_sessions gs, jsonb_array_elements(gs.rounds) r where gs.user_id = pr.id), 0)
          + coalesce((select sum(least(greatest(dr.score, 0), 1000)) from public.daily_results dr where dr.user_id = pr.id), 0)
          + coalesce((select sum(least(greatest(ma.round_score, 0), 1000)) from public.multiplayer_answers ma where ma.user_id = pr.id), 0))::bigint as sum_round_score,
         coalesce((
           with d as (select distinct date as dt from public.daily_results where user_id = pr.id),
           a as (select case when exists(select 1 from d where dt = current_date) then current_date
                             when exists(select 1 from d where dt = current_date - 1) then current_date - 1
                             else null end as anchor),
           isl as (select dt, (dt - (row_number() over (order by dt))::int)::date as grp from d)
           select count(*) from isl, a
            where a.anchor is not null and isl.dt <= a.anchor and isl.grp = (select grp from isl where dt = a.anchor)
         ), 0)::int as streak,
         pr.created_at,
         (select count(*) + 1 from pop p
            where p.xp > coalesce((select xp from tgt), -1)
               or (p.xp = (select xp from tgt) and p.total_score > (select total_score from tgt)))::int as world_rank
    from public.profiles pr
   where pr.id = p_user_id;
$$;
revoke all on function public.public_profile(uuid) from public;
grant execute on function public.public_profile(uuid) to authenticated;
