-- Distribuce skóre denní výzvy: zahrnout i hosty (dřív jen registrovaní).
-- Zjednodušeno — bez joinu na profiles (žádná RLS závislost).

create or replace function public.daily_score_distribution(p_date date)
returns integer[]
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(array_agg(r.score order by r.score), '{}')
  from public.daily_results r
  where r.date = p_date;
$$;

comment on function public.daily_score_distribution(date) is
  'Pole skóre všech hráčů (vč. hostů) pro daný den — pro histogram distribuce.';
