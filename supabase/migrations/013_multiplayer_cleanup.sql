-- HistoryGuessr · Migrace 013 · Úklid starých multiplayer místností
--
-- Místnosti (a jejich kola/odpovědi/hráči) se po dohrání ani opuštění
-- nemažou → DB bobtná. Tato funkce smaže vše starší než 6 hodin
-- (dohrané, opuštěné i zapomenutá „waiting" lobby).
--
-- Funkce běží jako SECURITY DEFINER, takže ji RLS neomezuje.
--
-- Spusť v Supabase SQL editoru.

create or replace function public.cleanup_multiplayer()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ids uuid[];
begin
  select array_agg(id) into ids
    from public.multiplayer_rooms
   where updated_at < now() - interval '6 hours';

  if ids is null then
    return;
  end if;

  delete from public.multiplayer_answers where room_id = any(ids);
  delete from public.multiplayer_rounds  where room_id = any(ids);
  delete from public.multiplayer_players where room_id = any(ids);
  delete from public.multiplayer_rooms   where id = any(ids);
end;
$$;

-- ── Naplánování přes pg_cron (volitelné) ──────────────────
-- Vyžaduje povolené rozšíření pg_cron (Supabase → Database → Extensions).
-- Když ho nemáš zapnuté, tenhle blok přeskoč — funkci můžeš spouštět
-- i ručně: select public.cleanup_multiplayer();
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'cleanup_multiplayer_hourly',
      '0 * * * *',
      $cron$ select public.cleanup_multiplayer(); $cron$
    );
  end if;
end $$;
