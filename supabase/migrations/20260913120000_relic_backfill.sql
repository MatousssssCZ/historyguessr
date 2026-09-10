-- Zpětné udělení relikvií: kdo kampaň dokončil DŘÍV, než relikvie vznikla,
-- ji nedostal (grant trigger běží jen při dokončení). Tahle migrace doplní
-- relikvie všem, kdo mají hotovou kampaň, a přidá trigger na `relics`, takže
-- když admin relikvii ke kampani přiřadí, hráči co ji dohráli ji dostanou hned.
-- Vzácnost: legendary=plný počet bodů, epic=3★, rare=2★, common=dokončeno. Idempotentní.
-- ⚠ Vyžaduje už spuštěnou migraci 20260911130000_relic_rarity.sql (4 vzácnosti).

create or replace function public.backfill_relic_grants(p_campaign uuid)
  returns void language plpgsql security definer set search_path to 'public'
as $$
declare v_relic uuid; v_max integer;
begin
  select id into v_relic from public.relics where campaign_id = p_campaign;
  if v_relic is null then return; end if;
  select rounds_count * 1000 into v_max from public.campaigns where id = p_campaign;

  insert into public.player_relics (user_id, relic_id, state, acquired_at)
  select p.user_id, v_relic,
    case
      when p.best_score >= v_max then 'legendary'
      when p.best_stars >= 3      then 'epic'
      when p.best_stars >= 2      then 'rare'
      else 'common' end,
    now()
  from public.user_campaign_progress p
  where p.campaign_id = p_campaign and coalesce(p.completed_runs, 0) > 0
  on conflict (user_id, relic_id) do update set state = case
    when (case public.player_relics.state when 'legendary' then 4 when 'epic' then 3 when 'rare' then 2 else 1 end)
       >= (case excluded.state           when 'legendary' then 4 when 'epic' then 3 when 'rare' then 2 else 1 end)
    then public.player_relics.state else excluded.state end;
end; $$;

-- Jednorázový backfill všech existujících relikvií.
do $$ declare c uuid; begin
  for c in select campaign_id from public.relics where campaign_id is not null loop
    perform public.backfill_relic_grants(c);
  end loop;
end $$;

-- Když se relikvie vytvoří / přiřadí ke kampani, doplň ji hráčům, kteří ji už dohráli.
create or replace function public.relic_grant_on_change()
  returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.campaign_id is not null then perform public.backfill_relic_grants(new.campaign_id); end if;
  return new;
end; $$;

drop trigger if exists trg_relic_backfill on public.relics;
create trigger trg_relic_backfill
  after insert or update of campaign_id on public.relics
  for each row execute function public.relic_grant_on_change();
