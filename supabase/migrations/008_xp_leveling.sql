-- HistoryGuessr · Migrace 008 · XP / leveling
-- Přidá sloupec xp do profiles, předvyplní z dosavadního skóre
-- a přidá bezpečnou inkrementační funkci.
--
-- Spusť v Supabase SQL editoru.

alter table public.profiles
  add column if not exists xp bigint not null default 0;

-- Jednorázový backfill: dosavadní celkové skóre = startovní XP
update public.profiles set xp = total_score where xp = 0;

-- Atomický přírůstek XP (security definer → nejde obejít RLS)
create or replace function public.add_xp(p_user_id uuid, p_amount int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set xp = coalesce(xp, 0) + greatest(p_amount, 0)
   where id = p_user_id;
$$;

grant execute on function public.add_xp(uuid, int) to authenticated;
