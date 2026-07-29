-- HistoryGuessr · Migrace 027 · Zavírání neaktivních čekáren (lobby)
--
-- Čekárny (status 'waiting'), kde se hodinu nic nedělo, se označí jako
-- 'finished' (zmizí z aktivních). Fyzicky je pak smaže cleanup_multiplayer()
-- po 6 hodinách (migrace 013).
--
-- SECURITY DEFINER → RLS neomezuje. Spusť v Supabase SQL editoru. Idempotentní.

create or replace function public.close_inactive_lobbies()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.multiplayer_rooms
     set status = 'finished', updated_at = now()
   where status = 'waiting'
     and updated_at < now() - interval '1 hour';
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.close_inactive_lobbies() to authenticated;

-- ── Naplánování přes pg_cron (každých 15 minut) ───────────
-- Vyžaduje rozšíření pg_cron: Supabase → Database → Extensions → zapni „pg_cron".
-- Bez něj tenhle blok nic neudělá — funkci lze spouštět i ručně:
--   select public.close_inactive_lobbies();
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'close_inactive_lobbies_15min') then
      perform cron.unschedule('close_inactive_lobbies_15min');
    end if;
    perform cron.schedule(
      'close_inactive_lobbies_15min',
      '*/15 * * * *',
      $cron$ select public.close_inactive_lobbies(); $cron$
    );
  end if;
end $$;
