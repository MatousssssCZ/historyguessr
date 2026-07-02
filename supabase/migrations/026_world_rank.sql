-- HistoryGuessr · Migrace 026 · Světový žebříček (pořadí dle XP)
--
-- RLS profilů dovolí klientovi číst jen vlastní profil, takže počítání pořadí
-- z klienta vracelo vždy „#1 z 1". Tato SECURITY DEFINER funkce spočítá pořadí
-- a celkový počet hráčů na serveru (obchází RLS, čte jen agregát — bez úniku dat).
--
-- rank = kolik hráčů má víc XP než volající + 1.
--
-- Spusť v Supabase SQL editoru. Idempotentní.

create or replace function public.get_world_rank()
returns table(rank bigint, total bigint)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.profiles p
       where coalesce(p.xp, 0) > coalesce((select xp from public.profiles where id = auth.uid()), 0)
    ) + 1 as rank,
    (select count(*) from public.profiles) as total
$$;

grant execute on function public.get_world_rank() to authenticated;
