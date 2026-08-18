-- Veřejný profil hráče (Fáze B). profiles/user_category_hits mají RLS na
-- vlastní řádek → SECURITY DEFINER vystaví jen bezpečnou veřejnou podmnožinu
-- (username, level/xp, skóre, počet her/kol, člen od, pořadí). Nikdy e-mail.

create or replace function public.public_profile(p_user_id uuid)
returns table(username text, xp bigint, total_score bigint, games_played int, rounds_played int, created_at timestamptz, world_rank int)
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
         pr.created_at,
         (select count(*) + 1 from pop p
            where p.total_score > coalesce((select total_score from tgt), -1)
               or (p.total_score = (select total_score from tgt) and p.xp > (select xp from tgt)))::int as world_rank
    from public.profiles pr
   where pr.id = p_user_id;
$$;

-- Odznaky (počty úspěšných kol po kategoriích) pro veřejný profil.
create or replace function public.public_category_hits(p_user_id uuid)
returns table(category text, hits int)
language sql
security definer
stable
set search_path = public
as $$
  select uch.category, uch.hits
    from public.user_category_hits uch
   where uch.user_id = p_user_id;
$$;

revoke all on function public.public_profile(uuid) from public;
revoke all on function public.public_category_hits(uuid) from public;
grant execute on function public.public_profile(uuid) to authenticated;
grant execute on function public.public_category_hits(uuid) to authenticated;
