-- HistoryGuessr · Migrace 040 · Dávkový úklid multiplayeru (škálovatelný)
--
-- SOBĚSTAČNÁ migrace — obsahuje i vše z 039 (indexy, brzda), takže po 038
-- stačí spustit jen tuhle.
--
-- Algoritmus úklidu:
--   • centrálně brzděné (last_run + advisory lock) → tisíce souběžných volání =
--     1 skutečný běh + zbytek bleskové no-opy
--   • mazání PO DÁVKÁCH (500 řádků) se `for update skip locked`:
--       - krátké zámky, žádný obří DELETE držící tabulku
--       - dva běžci se neperou o stejné řádky (žádné deadlocky)
--       - bezpečný strop dávek proti nekonečnému cyklu
--   • indexovaný predikát na updated_at → levné hledání kandidátů
--
-- Spusť v Supabase SQL editoru. Idempotentní. Navazuje na 038.

-- ── 1) Indexy (z 039) ─────────────────────────────────────
create index if not exists idx_mp_rooms_updated on public.multiplayer_rooms(updated_at);
create index if not exists idx_mp_rooms_status_updated on public.multiplayer_rooms(status, updated_at);

-- ── 2) Stav úklidu — kdy naposledy proběhl (z 039) ────────
create table if not exists public.mp_maintenance (
  id       boolean primary key default true check (id),
  last_run timestamptz
);
insert into public.mp_maintenance (id, last_run) values (true, null)
on conflict (id) do nothing;
alter table public.mp_maintenance enable row level security;  -- zápis jen serverovými funkcemi

-- ── 3) Zavření neaktivních čekáren (z 038) ────────────────
create or replace function public.close_inactive_lobbies()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.multiplayer_rooms
     set status = 'finished', updated_at = now()
   where status = 'waiting'
     and updated_at < now() - interval '1 hour';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ── 4) Dávkové mazání starých místností ───────────────────
-- Mění se návratový typ (void → integer), proto DROP před CREATE.
drop function if exists public.cleanup_multiplayer();

create or replace function public.cleanup_multiplayer()
returns integer                      -- počet smazaných místností
language plpgsql
security definer
set search_path = public
as $$
declare
  c_batch       constant int := 500; -- velikost dávky (krátké zámky)
  c_max_batches constant int := 200; -- strop: max 100k místností na běh
  v_ids   uuid[];
  v_total int := 0;
  v_i     int := 0;
begin
  loop
    v_i := v_i + 1;
    exit when v_i > c_max_batches;

    -- Vyber dávku starých místností; přeskoč řádky zamčené jiným během
    select array_agg(id) into v_ids
      from (
        select id from public.multiplayer_rooms
         where updated_at < now() - interval '6 hours'
         order by updated_at
         limit c_batch
         for update skip locked
      ) s;

    exit when v_ids is null;   -- nic dalšího ke smazání

    delete from public.multiplayer_answers where room_id = any(v_ids);
    delete from public.multiplayer_rounds  where room_id = any(v_ids);
    delete from public.multiplayer_players where room_id = any(v_ids);
    delete from public.multiplayer_rooms   where id = any(v_ids);

    v_total := v_total + coalesce(array_length(v_ids, 1), 0);
    exit when coalesce(array_length(v_ids, 1), 0) < c_batch;  -- poslední (neúplná) dávka
  end loop;

  return v_total;
end;
$$;

-- ── 5) Globálně brzděný úklidový krok (z 039) ─────────────
create or replace function public.maintain_multiplayer()
returns integer                      -- počet smazaných místností
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last    timestamptz;
  v_deleted int := 0;
begin
  -- Levná první kontrola (PK): nedávno běželo → hned pryč
  select last_run into v_last from public.mp_maintenance where id;
  if v_last is not null and v_last > now() - interval '5 minutes' then
    return 0;
  end if;

  -- Jen jeden běžec zároveň; ostatní se hned vrátí
  if not pg_try_advisory_xact_lock(778811) then
    return 0;
  end if;

  -- Druhá kontrola po zámku (mohl mezitím doběhnout jiný)
  select last_run into v_last from public.mp_maintenance where id;
  if v_last is not null and v_last > now() - interval '5 minutes' then
    return 0;
  end if;

  perform public.close_inactive_lobbies();  -- 'waiting' > 1 h → 'finished'
  v_deleted := public.cleanup_multiplayer(); -- cokoli > 6 h → smazat (dávkově)

  update public.mp_maintenance set last_run = now() where id;
  return v_deleted;
end;
$$;

-- ── 6) Granty ─────────────────────────────────────────────
grant execute on function public.close_inactive_lobbies() to authenticated;
grant execute on function public.cleanup_multiplayer()    to authenticated;
grant execute on function public.maintain_multiplayer()   to authenticated;

-- ── 7) pg_cron (bonus, když je zapnutý) ───────────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'maintain_multiplayer_15min') then
      perform cron.unschedule('maintain_multiplayer_15min');
    end if;
    perform cron.schedule('maintain_multiplayer_15min', '*/15 * * * *',
      $cron$ select public.maintain_multiplayer(); $cron$);
  end if;
end $$;

-- Ověření:
--   select public.maintain_multiplayer();   -- 1. běh uklidí, vrátí počet smazaných
--   select public.maintain_multiplayer();   -- do 5 min vrátí 0 hned (brzda)
--   select last_run from public.mp_maintenance;
