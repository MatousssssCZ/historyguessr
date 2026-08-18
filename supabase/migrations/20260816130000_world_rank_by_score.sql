-- Sjednocení: „Pořadí ve světě" na domovské řadilo podle XP, ale žebříček
-- (global_leaderboard) řadí podle total_score → nesouhlasily. Přepínáme
-- get_world_rank na STEJNÉ pořadí i populaci jako žebříček (total_score desc,
-- xp desc; jen hráči s odehranou hrou a přezdívkou).

create or replace function public.get_world_rank()
returns table(rank bigint, total bigint)
language sql
security definer
stable
set search_path = public
as $$
  with pop as (
    select id, total_score, xp
      from public.profiles
     where games_played > 0 and username is not null
  ),
  me as (select total_score, xp from pop where id = auth.uid())
  select
    (select count(*) + 1
       from pop p
      where p.total_score > coalesce((select total_score from me), -1)
         or (p.total_score = (select total_score from me) and p.xp > (select xp from me))
    )::bigint as rank,
    (select count(*) from pop)::bigint as total;
$$;

grant execute on function public.get_world_rank() to authenticated;
