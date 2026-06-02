-- HistoryGuessr · Migrace 009 · Statistiky zahraného skóre na událost
-- Umožní vyhodnotit reálnou obtížnost (průměrné skóre celkem / poloha / rok).
--
-- Spusť v Supabase SQL editoru.

alter table public.events
  add column if not exists score_count    int    not null default 0,
  add column if not exists score_sum      bigint not null default 0,
  add column if not exists score_loc_sum  bigint not null default 0,
  add column if not exists score_year_sum bigint not null default 0;

-- Zaznamená jedno zahrané kolo (poloha + rok skóre) k události.
-- Volá se ze všech režimů (sólo, daily, multiplayer).
create or replace function public.record_event_score(
  p_event_id uuid,
  p_location int,
  p_year     int
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.events
     set play_count     = play_count + 1,
         score_count    = score_count + 1,
         score_sum      = score_sum + greatest(p_location, 0) + greatest(p_year, 0),
         score_loc_sum  = score_loc_sum + greatest(p_location, 0),
         score_year_sum = score_year_sum + greatest(p_year, 0)
   where id = p_event_id;
$$;

grant execute on function public.record_event_score(uuid, int, int) to authenticated;
