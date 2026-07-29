-- HistoryGuessr · Migrace 042 · Oprava start_campaign_attempt (ambiguous attempt_id)
--
-- CHYBA: „column reference \"attempt_id\" is ambiguous"
-- Funkce má OUT sloupec `attempt_id` (z returns table(...)), který se ve dvou
-- dotazech nad public.campaign_attempt_rounds sráží se stejnojmenným sloupcem
-- tabulky (`where attempt_id = …`). Postgres neví, který myslíme → kampaň nešla
-- spustit. Řešení: v těch dotazech odkaz KVALIFIKOVAT názvem tabulky.
--
-- Jinak je funkce shodná s migrací 032. Spusť v Supabase SQL editoru. Idempotentní.

create or replace function public.start_campaign_attempt(p_campaign_id uuid)
returns table(attempt_id uuid, rounds_total int, event_ids uuid[], energy_left int, resumed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_cat       uuid;
  v_rounds    int;
  v_cat_prem  boolean; v_camp_prem boolean;
  v_req_glob  int; v_req_cat int;
  v_prem      boolean;
  v_today     date := (now() at time zone 'utc')::date;
  v_free      int; v_used int; v_bonus int; v_limit int;
  v_limit_on  boolean;
  v_existing  uuid;
  v_attempt   uuid;
  v_events    uuid[];
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select c.category_id, c.rounds_count, c.is_premium, c.required_category_stars,
         cat.is_premium, cat.required_global_stars
    into v_cat, v_rounds, v_camp_prem, v_req_cat, v_cat_prem, v_req_glob
    from public.campaigns c
    join public.campaign_categories cat on cat.id = c.category_id
   where c.id = p_campaign_id and c.status = 'published' and cat.status = 'published';
  if v_cat is null then raise exception 'campaign_not_available'; end if;

  if (select count(*) from public.campaign_events
       where campaign_id = p_campaign_id and is_active) <> v_rounds then
    raise exception 'campaign_incomplete';
  end if;

  -- Hvězdy (Premium je NIKDY neobchází)
  if public.user_global_stars(v_uid) < v_req_glob then raise exception 'locked_global_stars'; end if;
  if public.user_category_stars(v_cat, v_uid) < v_req_cat then raise exception 'locked_category_stars'; end if;

  -- Premium obsah
  v_prem := public.is_premium(v_uid);
  if (v_cat_prem or v_camp_prem) and not v_prem then raise exception 'premium_required'; end if;

  -- Obnova rozehraného pokusu — NEstojí další výpravu
  select id into v_existing from public.campaign_attempts
   where user_id = v_uid and campaign_id = p_campaign_id and status = 'in_progress'
     and expires_at > now()
   limit 1;
  if v_existing is not null then
    select array_agg(r.event_id order by r.position) into v_events
      from public.campaign_attempt_rounds r where r.attempt_id = v_existing;
    return query select v_existing, v_rounds, coalesce(v_events, '{}'),
                        public.remaining_expeditions(v_uid), true;
    return;
  end if;

  update public.campaign_attempts set status = 'expired'
   where user_id = v_uid and status = 'in_progress' and expires_at <= now();

  -- ── Denní limit výprav ──
  v_limit_on := public.config_bool('campaign_limit_enabled', true);
  if v_limit_on and not v_prem then
    v_free := public.config_int('free_expeditions_per_day', 5);
    select used_count, bonus_count into v_used, v_bonus
      from public.user_daily_campaign_usage
     where user_id = v_uid and usage_date = v_today;
    v_used := coalesce(v_used, 0); v_bonus := coalesce(v_bonus, 0);
    v_limit := v_free + v_bonus;
    if v_used >= v_limit then raise exception 'no_energy'; end if;

    -- Výprava se odečte až TEĎ, při skutečném vytvoření pokusu
    insert into public.user_daily_campaign_usage (user_id, usage_date, used_count)
    values (v_uid, v_today, 1)
    on conflict (user_id, usage_date) do update
      set used_count = public.user_daily_campaign_usage.used_count + 1, updated_at = now();
  end if;

  insert into public.campaign_attempts (user_id, campaign_id, status, rounds_total)
  values (v_uid, p_campaign_id, 'in_progress', v_rounds)
  returning id into v_attempt;

  insert into public.campaign_attempt_rounds (attempt_id, position, event_id)
  select v_attempt, ce.position, ce.event_id
    from public.campaign_events ce
   where ce.campaign_id = p_campaign_id and ce.is_active
   order by ce.position;

  insert into public.user_campaign_progress (user_id, campaign_id, attempts_count, last_played_at)
  values (v_uid, p_campaign_id, 1, now())
  on conflict (user_id, campaign_id) do update
    set attempts_count = public.user_campaign_progress.attempts_count + 1, last_played_at = now();

  select array_agg(r.event_id order by r.position) into v_events
    from public.campaign_attempt_rounds r where r.attempt_id = v_attempt;

  return query select v_attempt, v_rounds, coalesce(v_events, '{}'),
                      public.remaining_expeditions(v_uid), false;
end;
$$;
grant execute on function public.start_campaign_attempt(uuid) to authenticated;
