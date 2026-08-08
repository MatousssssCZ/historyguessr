-- HistoryGuessr · Serverová pojistka pro vstup do MP místnosti
--
-- Dnes kapacitu (12) a „jen když čeká" hlídá jen klient. Tohle to vynutí i na
-- serveru. Použit BEFORE INSERT trigger (SECURITY DEFINER) — nikoli RLS
-- subquery, protože ta by na multiplayer_players/_rooms způsobila nekonečnou
-- rekurzi mezi policies. Trigger navíc zamkne řádek místnosti → bez race.
--
-- Reconnect/re-join stávajícího hráče projde vždy (kontroluje se jen NOVÝ hráč).
-- Idempotentní. Testuj lokálně `supabase db reset`, pak spusť na produkci.

-- ── RLS: jednoduchá insert policy (jen vlastní řádek) ─────
drop policy if exists "players insert"      on public.multiplayer_players;
drop policy if exists "players: insert own" on public.multiplayer_players;
drop policy if exists "players: join"       on public.multiplayer_players;
create policy "players: join" on public.multiplayer_players
  for insert to authenticated
  with check (user_id = auth.uid());

-- ── Trigger: status 'waiting' + kapacita 12 (jen pro NOVÉ hráče) ──
create or replace function public.enforce_mp_join()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_count  int;
begin
  -- Reconnect / re-join stávajícího hráče → propusť bez kontrol
  if exists (select 1 from public.multiplayer_players
              where room_id = new.room_id and user_id = new.user_id) then
    return new;
  end if;

  select status into v_status from public.multiplayer_rooms
    where id = new.room_id for update;   -- zámek → serializuje souběžné joiny
  if v_status is null      then raise exception 'room_not_found'; end if;
  if v_status <> 'waiting' then raise exception 'room_not_open';  end if;

  select count(*) into v_count from public.multiplayer_players where room_id = new.room_id;
  if v_count >= 12 then raise exception 'room_full'; end if;

  return new;
end $$;

drop trigger if exists trg_enforce_mp_join on public.multiplayer_players;
create trigger trg_enforce_mp_join
  before insert on public.multiplayer_players
  for each row execute function public.enforce_mp_join();
