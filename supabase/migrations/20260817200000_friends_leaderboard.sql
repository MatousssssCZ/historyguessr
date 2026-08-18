-- Žebříček přátel (celoživotní) pro stránku /leaderboard — STEJNÁ metrika jako
-- „Svět" (total_score desc, xp desc), aby čísla u téhož hráče seděla.
-- Týdenní žebříček přátel (friends_week_scores) zůstává na domovské kartě.

create or replace function public.friends_leaderboard()
returns table(rank int, user_id uuid, username text, xp bigint, total_score bigint)
language sql
security definer
stable
set search_path = public
as $$
  with me_and_friends as (
    select auth.uid() as id
    union
    select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
      from public.friendships f
     where (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
       and f.status = 'accepted'
  )
  select (row_number() over (order by pr.total_score desc, pr.xp desc))::int as rank,
         pr.id, pr.username, pr.xp, pr.total_score
    from me_and_friends m
    join public.profiles pr on pr.id = m.id
   order by pr.total_score desc, pr.xp desc;
$$;

revoke all on function public.friends_leaderboard() from public;
grant execute on function public.friends_leaderboard() to authenticated;
