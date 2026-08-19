-- Stálý sloupec profiles.rounds_played = počet odehraných kol napříč režimy.
-- Backfill z game_sessions (délka rounds) + daily_results + multiplayer_answers,
-- pak udržováno triggery při dalších kolech.

alter table public.profiles add column if not exists rounds_played integer not null default 0;

-- Jednorázový backfill
update public.profiles p set rounds_played =
    coalesce((select sum(jsonb_array_length(gs.rounds)) from public.game_sessions gs where gs.user_id = p.id), 0)
  + coalesce((select count(*) from public.daily_results dr where dr.user_id = p.id), 0)
  + coalesce((select count(*) from public.multiplayer_answers ma where ma.user_id = p.id), 0);

-- Denní výzva: každý vložený výsledek = 1 kolo
create or replace function public.bump_rounds_daily() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set rounds_played = rounds_played + 1 where id = new.user_id;
  return new;
end $$;
drop trigger if exists trg_rounds_daily on public.daily_results;
create trigger trg_rounds_daily after insert on public.daily_results
  for each row execute function public.bump_rounds_daily();

-- Multiplayer: každá odpověď = 1 kolo
create or replace function public.bump_rounds_mp() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set rounds_played = rounds_played + 1 where id = new.user_id;
  return new;
end $$;
drop trigger if exists trg_rounds_mp on public.multiplayer_answers;
create trigger trg_rounds_mp after insert on public.multiplayer_answers
  for each row execute function public.bump_rounds_mp();

-- Sólo/kampaň: game_sessions.rounds se doplní při dokončení → přičti přírůstek
create or replace function public.bump_rounds_session() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_delta int;
begin
  v_delta := jsonb_array_length(new.rounds) - jsonb_array_length(old.rounds);
  if v_delta <> 0 then
    update public.profiles set rounds_played = rounds_played + v_delta where id = new.user_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_rounds_session on public.game_sessions;
create trigger trg_rounds_session after update of rounds on public.game_sessions
  for each row execute function public.bump_rounds_session();
