-- Návrat zabraného zadání do zásobníku, když se nic neuložilo.
--
-- Kontext: editor si vezme zadání (claim → in_progress, assigned_to). Pokud odejde,
-- aniž by uložil draft nebo odeslal ke schválení (event_id zůstane null), zadání
-- dosud viselo „in_progress" navždy a nikdo jiný si ho nemohl vzít. Nově se vrátí
-- do zásobníku (todo). Zadání s uloženým draftem (event_id != null) zůstávají zabraná.

-- Editor sám opustí zadání bez uložení (volá se při zavření formuláře).
create or replace function public.release_event_task(p_task uuid)
  returns void language plpgsql security definer set search_path to 'public' as $$
begin
  update public.event_tasks
     set status = 'todo', assigned_to = null
   where id = p_task
     and assigned_to = auth.uid()
     and status = 'in_progress'
     and event_id is null;   -- jen když se nic neuložilo
end $$;
grant execute on function public.release_event_task(uuid) to authenticated;

-- Pojistka pro opuštěné relace (zavřený prohlížeč). Uvolní in_progress bez draftu
-- starší než p_minutes. Volá se oportunisticky při načtení číselníku (staff),
-- takže není potřeba pg_cron. Minimum 5 min, ať se nevyhodí aktivně otevřený formulář.
create or replace function public.release_stale_event_tasks(p_minutes int default 45)
  returns int language plpgsql security definer set search_path to 'public' as $$
declare v int;
begin
  if not public.is_editor() then raise exception 'forbidden'; end if;
  update public.event_tasks
     set status = 'todo', assigned_to = null
   where status = 'in_progress'
     and event_id is null
     and updated_at < now() - make_interval(mins => greatest(p_minutes, 5));
  get diagnostics v = row_count;
  return v;
end $$;
grant execute on function public.release_stale_event_tasks(int) to authenticated;
