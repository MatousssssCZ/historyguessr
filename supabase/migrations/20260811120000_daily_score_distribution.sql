-- ─────────────────────────────────────────────────────────────
-- Distribuce skóre denní výzvy.
--
-- Problém: getDailyAllScores dělal join `profiles!inner(is_anonymous)`.
-- RLS na profiles povoluje jen VLASTNÍ profil (auth.uid() = id), takže join
-- vrátil jen řádek přihlášeného uživatele → distribuce se nikdy neukázala
-- (a pro anon dokonce „permission denied for table profiles").
--
-- Řešení: SECURITY DEFINER funkce, která vrátí jen POLE SKÓRE registrovaných
-- hráčů pro daný den (žádná osobní data), a obejde tak profiles RLS.
-- ─────────────────────────────────────────────────────────────

create or replace function public.daily_score_distribution(p_date date)
returns integer[]
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(array_agg(r.score order by r.score), '{}')
  from public.daily_results r
  join public.profiles p on p.id = r.user_id
  where r.date = p_date
    and coalesce(p.is_anonymous, false) = false;
$$;

comment on function public.daily_score_distribution(date) is
  'Pole skóre registrovaných hráčů pro daný den (pro histogram distribuce). Bez osobních dat.';

revoke all on function public.daily_score_distribution(date) from public;
grant execute on function public.daily_score_distribution(date) to anon, authenticated;
