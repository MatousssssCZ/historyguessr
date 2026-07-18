-- HistoryGuessr · Migrace 038 · Spolehlivý úklid multiplayeru (bez závislosti na cronu)
--
-- Problém: cron joby z migrací 013 a 027 jsou obalené v
--   `if exists (pg_cron) then ...`. Když pg_cron NENÍ zapnutý (výchozí stav),
--   blok tiše nic neudělá → místnosti se nikdy neuklidí, DB bobtná.
--
-- Řešení: úklid se dá spustit i z klienta (throttlovaně při otevření MP lobby).
--   K tomu potřebují obě funkce grant pro roli authenticated.
--   Cron zůstává jako bonus, když ho někdy zapneš.
--
-- Spusť v Supabase SQL editoru. Idempotentní. Vyžaduje migrace 013 a 027.

-- Klient smí spustit úklid (funkce jsou SECURITY DEFINER, mažou jen staré místnosti)
grant execute on function public.cleanup_multiplayer() to authenticated;
grant execute on function public.close_inactive_lobbies() to authenticated;

-- Kombinovaný krok pro klienta: zavři neaktivní čekárny + smaž staré místnosti.
-- Vrací počet zavřených čekáren (jen informativně).
create or replace function public.maintain_multiplayer()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  n := public.close_inactive_lobbies();  -- 'waiting' > 1 h → 'finished'
  perform public.cleanup_multiplayer();  -- cokoli > 6 h → smazat
  return n;
end;
$$;
grant execute on function public.maintain_multiplayer() to authenticated;

-- ── Naplánování přes pg_cron (když je zapnutý) ────────────
-- Idempotentní: přeplánuje jeden job, který dělá obojí každých 15 minut.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'maintain_multiplayer_15min') then
      perform cron.unschedule('maintain_multiplayer_15min');
    end if;
    perform cron.schedule(
      'maintain_multiplayer_15min',
      '*/15 * * * *',
      $cron$ select public.maintain_multiplayer(); $cron$
    );
  end if;
end $$;

-- ── DIAGNOSTIKA (spusť samostatně pro ověření) ────────────
--   Je pg_cron zapnutý?
--     select * from pg_extension where extname = 'pg_cron';
--   Jaké cron joby běží?
--     select jobname, schedule, active from cron.job;
--   Kolik je starých místností teď?
--     select count(*) from public.multiplayer_rooms where updated_at < now() - interval '6 hours';
--   Ruční spuštění:
--     select public.maintain_multiplayer();
