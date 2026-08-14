-- „Přátelé dnes" na domovské obrazovce: součet VŠECH bodů, které hráč (a jeho
-- přátelé) dnes nasbírali napříč režimy — denní výzva, sólo hry, kampaně, MP.
-- SECURITY DEFINER: profiles/friendships mají RLS jen na vlastní řádek, tohle
-- ale potřebuje číst i profily přátel.

create or replace function public.friends_today_scores()
returns table(user_id uuid, username text, score bigint, is_me boolean)
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
  ),
  daily as (
    select user_id, sum(score)::bigint s
      from public.daily_results
     where date = current_date
     group by user_id
  ),
  solo as (
    select user_id, sum(total_score)::bigint s
      from public.game_sessions
     where finished_at is not null and finished_at::date = current_date
     group by user_id
  ),
  camp as (
    select user_id, sum(total_score)::bigint s
      from public.campaign_attempts
     where status = 'completed' and completed_at::date = current_date
     group by user_id
  ),
  mp as (
    select p.user_id, sum(p.total_score)::bigint s
      from public.multiplayer_players p
      join public.multiplayer_rooms r on r.id = p.room_id
     where r.status = 'finished' and r.updated_at::date = current_date
     group by p.user_id
  )
  select m.id as user_id,
         pr.username,
         (coalesce(d.s,0) + coalesce(so.s,0) + coalesce(c.s,0) + coalesce(mpx.s,0)) as score,
         (m.id = auth.uid()) as is_me
    from me_and_friends m
    join public.profiles pr on pr.id = m.id
    left join daily d   on d.user_id = m.id
    left join solo  so  on so.user_id = m.id
    left join camp  c   on c.user_id = m.id
    left join mp    mpx on mpx.user_id = m.id
   order by score desc, pr.username;
$$;

revoke all on function public.friends_today_scores() from public;
grant execute on function public.friends_today_scores() to authenticated;
