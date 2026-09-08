-- Relikvie: přechod z 2 stavů (preserved/perfect) na 4 ÚROVNĚ VZÁCNOSTI jako GLB modely.
-- Jedna relikvie na kampaň, povyšuje se: common → rare → epic → legendary.
-- legendary = plný počet bodů, epic = 3★, rare = 2★, common = dokončeno. Idempotentní.

alter table public.relics
  add column if not exists model_common    text,
  add column if not exists model_rare      text,
  add column if not exists model_epic      text,
  add column if not exists model_legendary text;

-- player_relics.state → 4 vzácnosti (migruj stará data: perfect→legendary, preserved→epic)
alter table public.player_relics drop constraint if exists player_relics_state_check;
update public.player_relics set state = 'legendary' where state = 'perfect';
update public.player_relics set state = 'epic'      where state = 'preserved';
alter table public.player_relics alter column state set default 'common';
alter table public.player_relics
  add constraint player_relics_state_check check (state in ('common','rare','epic','legendary'));

-- Udělení / upgrade relikvie podle nejlepšího výkonu v kampani. Nikdy nedegraduje.
create or replace function public.grant_relic_on_progress()
  returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare v_relic uuid; v_max integer; v_new text;
begin
  select r.id into v_relic from public.relics r where r.campaign_id = new.campaign_id;
  if v_relic is null then return new; end if;

  select rounds_count * 1000 into v_max from public.campaigns where id = new.campaign_id;
  v_new := case
    when new.best_score >= v_max then 'legendary'
    when new.best_stars >= 3      then 'epic'
    when new.best_stars >= 2      then 'rare'
    else 'common' end;

  insert into public.player_relics (user_id, relic_id, state, acquired_at)
    values (new.user_id, v_relic, v_new, now())
  on conflict (user_id, relic_id) do update set state = case
    when (case public.player_relics.state when 'legendary' then 4 when 'epic' then 3 when 'rare' then 2 else 1 end)
       >= (case excluded.state           when 'legendary' then 4 when 'epic' then 3 when 'rare' then 2 else 1 end)
    then public.player_relics.state else excluded.state end;

  return new;
end; $$;

drop trigger if exists trg_grant_relic on public.user_campaign_progress;
create trigger trg_grant_relic
  after insert or update of best_stars, best_score on public.user_campaign_progress
  for each row execute function public.grant_relic_on_progress();
