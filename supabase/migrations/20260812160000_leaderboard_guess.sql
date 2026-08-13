-- Žebříček denní výzvy: vrátit i tip hráče (guess), aby klient dopočítal
-- vzdálenost v km a rozdíl roku pro každý řádek (redesign detailu kola).

create or replace function public.daily_global_leaderboard(p_date date)
returns table(rank integer, user_id uuid, username text, score integer,
              guess_lat double precision, guess_lng double precision, guess_year integer)
language sql
security definer
stable
set search_path = public
as $$
  select
    (row_number() over (order by r.score desc, r.created_at asc))::int as rank,
    r.user_id, p.username, r.score,
    r.guess_lat, r.guess_lng, r.guess_year
  from public.daily_results r
  join public.profiles p on p.id = r.user_id
  where r.date = p_date
  order by r.score desc, r.created_at asc;
$$;

revoke all on function public.daily_global_leaderboard(date) from public;
grant execute on function public.daily_global_leaderboard(date) to anon, authenticated;
