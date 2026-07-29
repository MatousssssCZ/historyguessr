-- HistoryGuessr · Migrace 039 · Škálování úklidu multiplayeru
--
-- Klientský úklid (038) volá maintain_multiplayer() z každého prohlížeče.
-- Při tisících souběžných hráčů by to znamenalo stovky těžkých DELETE za minutu,
-- které navíc cílí na stejné staré řádky → duplicitní práce a zamykání.
--
-- Tato migrace to dělá škálovatelné:
--   1) index na updated_at → úklid netahá plný sken tabulky
--   2) GLOBÁLNÍ brzda: funkce si drží čas posledního běhu. Když nedávno běžela,
--      okamžitě se vrátí (jedno levné čtení). Takže i 1000 souběžných volání =
--      1 skutečný úklid + 999 bleskových no-opů.
--   3) advisory lock → nikdy neběží dva úklidy zároveň.
--
-- Spusť v Supabase SQL editoru. Idempotentní. Vyžaduje migraci 038.

-- 1) Indexy pro rychlý výběr starých místností
create index if not exists idx_mp_rooms_updated on public.multiplayer_rooms(updated_at);
create index if not exists idx_mp_rooms_status_updated on public.multiplayer_rooms(status, updated_at);

-- 2) Stav úklidu (jeden řádek) — kdy naposledy proběhl
create table if not exists public.mp_maintenance (
  id       boolean primary key default true check (id),
  last_run timestamptz
);
insert into public.mp_maintenance (id, last_run) values (true, null)
on conflict (id) do nothing;
-- Zápis jen serverovými funkcemi; klient sem nesahá (žádná RLS policy pro write).
alter table public.mp_maintenance enable row level security;

-- 3) Globálně brzděná verze — bezpečná i pro tisíce souběžných volání
create or replace function public.maintain_multiplayer()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
  n integer := 0;
begin
  -- Levná první kontrola (indexovaný PK): nedávno běželo → hned pryč
  select last_run into v_last from public.mp_maintenance where id;
  if v_last is not null and v_last > now() - interval '5 minutes' then
    return 0;
  end if;

  -- Jen jeden běžec zároveň; ostatní nečekají a vrátí se
  if not pg_try_advisory_xact_lock(778811) then
    return 0;
  end if;

  -- Druhá kontrola po získání zámku (mohl mezitím doběhnout jiný)
  select last_run into v_last from public.mp_maintenance where id;
  if v_last is not null and v_last > now() - interval '5 minutes' then
    return 0;
  end if;

  -- Skutečný úklid
  n := public.close_inactive_lobbies();  -- 'waiting' > 1 h → 'finished'
  perform public.cleanup_multiplayer();  -- cokoli > 6 h → smazat

  update public.mp_maintenance set last_run = now() where id;
  return n;
end;
$$;
grant execute on function public.maintain_multiplayer() to authenticated;

-- Ověření:
--   select public.maintain_multiplayer();        -- první volání uklidí
--   select public.maintain_multiplayer();        -- druhé (do 5 min) vrátí 0 hned
--   select last_run from public.mp_maintenance;
