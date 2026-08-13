-- Globální žebříček denní výzvy (všichni hráči, kdo odehráli daný den).
-- SECURITY DEFINER — profiles RLS povoluje jen vlastní profil, takže přímý
-- join by v klientovi vrátil jen jeden řádek. Vrací pořadí + jméno + skóre.

create or replace function public.daily_global_leaderboard(p_date date)
returns table(rank integer, user_id uuid, username text, score integer)
language sql
security definer
stable
set search_path = public
as $$
  select
    (row_number() over (order by r.score desc, r.created_at asc))::int as rank,
    r.user_id,
    p.username,
    r.score
  from public.daily_results r
  join public.profiles p on p.id = r.user_id
  where r.date = p_date
  order by r.score desc, r.created_at asc;
$$;

comment on function public.daily_global_leaderboard(date) is
  'Globální žebříček denní výzvy pro daný den (pořadí, jméno, skóre) — všichni hráči.';

revoke all on function public.daily_global_leaderboard(date) from public;
grant execute on function public.daily_global_leaderboard(date) to anon, authenticated;
