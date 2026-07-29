-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP EXTENSION pg_net;

COMMENT ON SCHEMA public IS NULL;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE UPDATE ON SEQUENCES FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES FROM authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE UPDATE ON SEQUENCES FROM authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON ROUTINES FROM postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES FROM service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE UPDATE ON SEQUENCES FROM service_role;

CREATE EXTENSION pg_cron WITH SCHEMA pg_catalog;

ALTER SCHEMA public OWNER TO postgres;

GRANT CREATE ON SCHEMA public TO PUBLIC;

REVOKE ALL ON SCHEMA public FROM pg_database_owner;

REVOKE USAGE ON SCHEMA public FROM service_role;

CREATE SEQUENCE public.events_seq_seq;

CREATE FUNCTION public.add_event_rating (
  p_event_id uuid,
  p_rating   integer
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
begin
  update public.events
  set rating_sum   = rating_sum + p_rating,
      rating_count = rating_count + 1
  where id = p_event_id;
end;
$function$;

CREATE FUNCTION public.add_xp (
  p_user_id uuid,
  p_amount  integer
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if p_amount <= 0 then return; end if;
  update public.profiles
     set xp = coalesce(xp, 0) + p_amount
   where id = p_user_id;
end;
$function$;

CREATE FUNCTION public.admin_duplicate_campaign (
  p_campaign_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_new uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'forbidden';
  end if;

  insert into public.campaigns (
    category_id, seq, title, title_en, title_de, description, description_en, description_de,
    visual_url, rounds_count, star_thresholds_pct, required_category_stars, is_premium, status
  )
  select category_id,
         (select coalesce(max(seq), 0) + 1 from public.campaigns x where x.category_id = c.category_id),
         c.title || ' (kopie)', c.title_en, c.title_de,
         c.description, c.description_en, c.description_de,
         c.visual_url, c.rounds_count, c.star_thresholds_pct, c.required_category_stars,
         c.is_premium, 'draft'
    from public.campaigns c where c.id = p_campaign_id
  returning id into v_new;

  if v_new is null then raise exception 'campaign_not_found'; end if;

  insert into public.campaign_events (campaign_id, position, event_id, is_active, admin_note)
  select v_new, ce.position, ce.event_id, ce.is_active, ce.admin_note
    from public.campaign_events ce where ce.campaign_id = p_campaign_id;

  return v_new;
end;
$function$;

GRANT ALL ON FUNCTION public.admin_duplicate_campaign(uuid) TO authenticated;

CREATE FUNCTION public.admin_grant_expeditions (
  p_user  uuid,
  p_count integer,
  p_date  date    DEFAULT NULL::date
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_day date := coalesce(p_date, (now() at time zone 'utc')::date);
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'forbidden';
  end if;
  if p_count < 0 then raise exception 'invalid_count'; end if;

  insert into public.user_daily_campaign_usage (user_id, usage_date, bonus_count)
  values (p_user, v_day, p_count)
  on conflict (user_id, usage_date) do update
    set bonus_count = public.user_daily_campaign_usage.bonus_count + excluded.bonus_count,
        updated_at = now();
end;
$function$;

GRANT ALL ON FUNCTION public.admin_grant_expeditions(uuid, integer, date) TO authenticated;

CREATE FUNCTION public.admin_set_premium (
  p_user       uuid,
  p_is_premium boolean,
  p_until      timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_reason     text                     DEFAULT NULL::text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_actor  uuid := auth.uid();
  v_before jsonb;
  v_after  jsonb;
begin
  if not exists (select 1 from public.profiles where id = v_actor and role = 'admin') then
    raise exception 'forbidden';
  end if;

  select to_jsonb(e) into v_before from public.user_entitlements e where e.user_id = p_user;

  insert into public.user_entitlements (user_id, is_premium, premium_until, source, granted_by, reason, updated_at)
  values (p_user, p_is_premium, p_until, 'admin', v_actor, p_reason, now())
  on conflict (user_id) do update set
    is_premium    = excluded.is_premium,
    premium_until = excluded.premium_until,
    source        = 'admin',
    granted_by    = v_actor,
    reason        = excluded.reason,
    updated_at    = now();

  select to_jsonb(e) into v_after from public.user_entitlements e where e.user_id = p_user;

  insert into public.entitlement_audit (user_id, action, actor_id, before, after)
  values (p_user, case when p_is_premium then 'grant_premium' else 'revoke_premium' end, v_actor, v_before, v_after);
end;
$function$;

GRANT ALL ON FUNCTION public.admin_set_premium(uuid, boolean, timestamp WITH time zone, text) TO authenticated;

CREATE FUNCTION public.advance_multiplayer_round (
  p_room_id        uuid,
  p_expected_round integer
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_total int;
  v_next  int;
  v_now   timestamptz := now();
begin
  -- Jen účastník místnosti smí posouvat
  if not exists (
    select 1 from public.multiplayer_players
    where room_id = p_room_id and user_id = auth.uid()
  ) then
    return;
  end if;

  -- Zamkni řádek místnosti a ověř, že jsme pořád na očekávaném kole
  select (settings->>'rounds')::int
    into v_total
    from public.multiplayer_rooms
   where id = p_room_id and current_round = p_expected_round
   for update;

  if not found then
    return;  -- někdo už posunul (idempotence)
  end if;

  v_next := p_expected_round + 1;

  if v_next > v_total then
    update public.multiplayer_rooms
       set status = 'finished', updated_at = v_now
     where id = p_room_id and current_round = p_expected_round;
  else
    update public.multiplayer_rounds
       set started_at = v_now + interval '3 seconds'
     where room_id = p_room_id and round_number = v_next;

    update public.multiplayer_rooms
       set current_round = v_next, updated_at = v_now
     where id = p_room_id and current_round = p_expected_round;
  end if;
end;
$function$;

GRANT ALL ON FUNCTION public.advance_multiplayer_round(uuid, integer) TO authenticated;

CREATE FUNCTION public.campaign_publish_errors (
  p_campaign_id uuid
)
  RETURNS text[]
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_rounds int;
  v_active int;
  v_errs text[] := '{}';
  v_bad int;
begin
  select c.rounds_count into v_rounds from public.campaigns c where c.id = p_campaign_id;
  if v_rounds is null then
    return array['Kampaň neexistuje.'];
  end if;

  select count(*) into v_active
    from public.campaign_events ce
   where ce.campaign_id = p_campaign_id and ce.is_active;

  if v_active <> v_rounds then
    v_errs := v_errs || format('Kampaň má %s z %s aktivních událostí.', v_active, v_rounds);
  end if;

  -- Nepublikovaná událost
  select count(*) into v_bad
    from public.campaign_events ce join public.events e on e.id = ce.event_id
   where ce.campaign_id = p_campaign_id and ce.is_active and coalesce(e.published, false) = false;
  if v_bad > 0 then
    v_errs := v_errs || format('%s událost(í) není publikovaných.', v_bad);
  end if;

  -- Chybějící panorama
  select count(*) into v_bad
    from public.campaign_events ce join public.events e on e.id = ce.event_id
   where ce.campaign_id = p_campaign_id and ce.is_active
     and (e.panorama_url is null or e.panorama_url = '' or e.panorama_url = 'pending');
  if v_bad > 0 then
    v_errs := v_errs || format('%s událost(í) nemá panorama.', v_bad);
  end if;

  -- Nevalidní GPS (mimo rozsah nebo nulový ostrov)
  select count(*) into v_bad
    from public.campaign_events ce join public.events e on e.id = ce.event_id
   where ce.campaign_id = p_campaign_id and ce.is_active
     and (e.lat is null or e.lng is null
          or e.lat not between -90 and 90 or e.lng not between -180 and 180
          or (e.lat = 0 and e.lng = 0));
  if v_bad > 0 then
    v_errs := v_errs || format('%s událost(í) nemá validní GPS.', v_bad);
  end if;

  -- Chybějící rok / rozsah
  select count(*) into v_bad
    from public.campaign_events ce join public.events e on e.id = ce.event_id
   where ce.campaign_id = p_campaign_id and ce.is_active
     and (coalesce(e.year_from, e.year) is null or coalesce(e.year_to, e.year) is null
          or coalesce(e.year_from, e.year) > coalesce(e.year_to, e.year));
  if v_bad > 0 then
    v_errs := v_errs || format('%s událost(í) nemá platný rok nebo rozsah.', v_bad);
  end if;

  return v_errs;
end;
$function$;

GRANT ALL ON FUNCTION public.campaign_publish_errors(uuid) TO authenticated;

CREATE FUNCTION public.campaign_stars_for_score (
  p_score      integer,
  p_rounds     integer,
  p_thresholds jsonb   DEFAULT NULL::jsonb
)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  with t as (
    select coalesce(
      p_thresholds,
      (select value from public.app_config where key = 'campaign_star_thresholds_pct'),
      '[0.40, 0.65, 0.85]'::jsonb
    ) as pct
  )
  select case
    when p_score >= round((p_rounds * 1000) * ((select pct->>2 from t)::numeric)) then 3
    when p_score >= round((p_rounds * 1000) * ((select pct->>1 from t)::numeric)) then 2
    when p_score >= round((p_rounds * 1000) * ((select pct->>0 from t)::numeric)) then 1
    else 0
  end
$function$;

GRANT ALL ON FUNCTION public.campaign_stars_for_score(integer, integer, jsonb) TO authenticated;

CREATE FUNCTION public.cleanup_multiplayer()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

GRANT ALL ON FUNCTION public.cleanup_multiplayer() TO authenticated;

CREATE FUNCTION public.cleanup_old_rooms()
  RETURNS void
  LANGUAGE sql
  AS $function$
  delete from public.multiplayer_rooms where created_at < now() - interval '24 hours';
$function$;

CREATE FUNCTION public.close_inactive_lobbies()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare n integer;
begin
  update public.multiplayer_rooms
     set status = 'finished', updated_at = now()
   where status = 'waiting'
     and updated_at < now() - interval '1 hour';
  get diagnostics n = row_count;
  return n;
end;
$function$;

GRANT ALL ON FUNCTION public.close_inactive_lobbies() TO authenticated;

CREATE FUNCTION public.complete_campaign_attempt (
  p_attempt_id uuid
)
  RETURNS TABLE (
    total_score integer,
    stars       integer,
    best_score  integer,
    best_stars  integer,
    is_best     boolean,
    new_rewards jsonb
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_uid uuid := auth.uid();
  v_status text; v_campaign uuid; v_rounds int;
  v_answered int; v_total int; v_stars int;
  v_thr jsonb;
  v_prev_score int;
  v_is_best boolean := false;
  v_rewards jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select a.status, a.campaign_id, a.rounds_total
    into v_status, v_campaign, v_rounds
    from public.campaign_attempts a
   where a.id = p_attempt_id and a.user_id = v_uid;
  if v_status is null then raise exception 'attempt_not_found'; end if;

  -- Idempotence: opakované dokončení vrátí uložený výsledek (bez nových odměn)
  if v_status = 'completed' then
    return query
      select a.total_score, a.stars, p.best_score, p.best_stars, false, '[]'::jsonb
        from public.campaign_attempts a
        join public.user_campaign_progress p
          on p.user_id = v_uid and p.campaign_id = a.campaign_id
       where a.id = p_attempt_id;
    return;
  end if;
  if v_status <> 'in_progress' then raise exception 'attempt_not_active'; end if;

  select count(*) into v_answered
    from public.campaign_attempt_rounds
   where attempt_id = p_attempt_id and answered_at is not null;
  if v_answered < v_rounds then raise exception 'rounds_incomplete'; end if;

  select coalesce(sum(round_score), 0) into v_total
    from public.campaign_attempt_rounds where attempt_id = p_attempt_id;

  select c.star_thresholds_pct into v_thr from public.campaigns c where c.id = v_campaign;
  v_stars := public.campaign_stars_for_score(v_total, v_rounds, v_thr);

  update public.campaign_attempts
     set status = 'completed', total_score = v_total, stars = v_stars, completed_at = now()
   where id = p_attempt_id;

  select p.best_score into v_prev_score
    from public.user_campaign_progress p
   where p.user_id = v_uid and p.campaign_id = v_campaign;
  if v_prev_score is null or v_total > v_prev_score then v_is_best := true; end if;

  -- Zlepšit ANO, zhoršit NE
  insert into public.user_campaign_progress
    (user_id, campaign_id, best_score, best_stars, completed_runs, attempts_count, first_completed_at, last_played_at)
  values (v_uid, v_campaign, v_total, v_stars, 1, 1, now(), now())
  on conflict (user_id, campaign_id) do update set
    best_score        = greatest(public.user_campaign_progress.best_score, excluded.best_score),
    best_stars        = greatest(public.user_campaign_progress.best_stars, excluded.best_stars),
    completed_runs    = public.user_campaign_progress.completed_runs + 1,
    first_completed_at = coalesce(public.user_campaign_progress.first_completed_at, now()),
    last_played_at    = now();

  -- Odměny dle NEJLEPŠÍCH ★ (zlepšením lze artefakt doplnit)
  v_rewards := public.grant_campaign_rewards(v_uid, v_campaign);

  return query
    select v_total, v_stars, p.best_score, p.best_stars, v_is_best, v_rewards
      from public.user_campaign_progress p
     where p.user_id = v_uid and p.campaign_id = v_campaign;
end;
$function$;

GRANT ALL ON FUNCTION public.complete_campaign_attempt(uuid) TO authenticated;

CREATE FUNCTION public.config_bool (
  p_key     text,
  p_default boolean
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select coalesce((select (value#>>'{}')::boolean from public.app_config where key = p_key), p_default)
$function$;

CREATE FUNCTION public.config_int (
  p_key     text,
  p_default integer
)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select coalesce((select (value#>>'{}')::int from public.app_config where key = p_key), p_default)
$function$;

CREATE FUNCTION public.demote_broken_campaign()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_campaign uuid := coalesce(new.campaign_id, old.campaign_id);
begin
  if exists (select 1 from public.campaigns where id = v_campaign and status = 'published')
     and array_length(public.campaign_publish_errors(v_campaign), 1) > 0 then
    update public.campaigns set status = 'draft', updated_at = now() where id = v_campaign;
  end if;
  return null;
end;
$function$;

CREATE FUNCTION public.enforce_campaign_publishable()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_errs text[];
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    v_errs := public.campaign_publish_errors(new.id);
    if array_length(v_errs, 1) > 0 then
      raise exception 'campaign_not_publishable: %', array_to_string(v_errs, ' ');
    end if;
  end if;
  -- Datum publikace drž automaticky
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$function$;

CREATE FUNCTION public.get_friend_requests()
  RETURNS TABLE (
    id       uuid,
    username text,
    xp       integer
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select pr.id, pr.username, pr.xp
    from public.friendships f
    join public.profiles pr on pr.id = f.requester_id
   where f.addressee_id = auth.uid() and f.status = 'pending'
   order by f.created_at desc;
$function$;

GRANT ALL ON FUNCTION public.get_friend_requests() TO authenticated;

CREATE FUNCTION public.get_friends()
  RETURNS TABLE (
    id       uuid,
    username text,
    xp       integer
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select pr.id, pr.username, pr.xp
    from public.friendships f
    join public.profiles pr
      on pr.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
   where (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
     and f.status = 'accepted'
   order by pr.username;
$function$;

GRANT ALL ON FUNCTION public.get_friends() TO authenticated;

CREATE FUNCTION public.get_my_entitlements()
  RETURNS TABLE (
    is_premium    boolean,
    premium_until timestamp with time zone
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select
    public.is_premium(auth.uid()) as is_premium,
    (select e.premium_until from public.user_entitlements e where e.user_id = auth.uid()) as premium_until
$function$;

GRANT ALL ON FUNCTION public.get_my_entitlements() TO authenticated;

CREATE FUNCTION public.get_my_expeditions()
  RETURNS TABLE (
    remaining  integer,
    per_day    integer,
    used       integer,
    bonus      integer,
    is_premium boolean,
    resets_at  timestamp with time zone
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
begin
  select coalesce(u.used_count, 0), coalesce(u.bonus_count, 0)
    into used, bonus
    from (select 1) x
    left join public.user_daily_campaign_usage u
      on u.user_id = v_uid and u.usage_date = v_today;

  remaining  := public.remaining_expeditions(v_uid);
  per_day    := public.config_int('free_expeditions_per_day', 5);
  is_premium := public.is_premium(v_uid);
  -- Reset: následující půlnoc UTC
  resets_at  := ((v_today + 1)::timestamp at time zone 'utc');
  return next;
end;
$function$;

GRANT ALL ON FUNCTION public.get_my_expeditions() TO authenticated;

CREATE FUNCTION public.get_my_rewards()
  RETURNS TABLE (
    id             uuid,
    campaign_id    uuid,
    kind           text,
    rarity         text,
    required_stars integer,
    name           text,
    name_en        text,
    name_de        text,
    description    text,
    description_en text,
    description_de text,
    icon_url       text,
    granted_at     timestamp with time zone
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select r.id, r.campaign_id, r.kind, r.rarity, r.required_stars,
         r.name, r.name_en, r.name_de,
         r.description, r.description_en, r.description_de,
         r.icon_url, ur.granted_at
    from public.user_campaign_rewards ur
    join public.campaign_rewards r on r.id = ur.reward_id
   where ur.user_id = auth.uid()
   order by ur.granted_at desc
$function$;

GRANT ALL ON FUNCTION public.get_my_rewards() TO authenticated;

CREATE FUNCTION public.get_shared_preset (
  p_slug text
)
  RETURNS TABLE (
    id         uuid,
    name       text,
    rules      jsonb,
    owner_name text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select p.id, p.name, p.rules, pr.username
    from public.single_player_presets p
    left join public.profiles pr on pr.id = p.user_id
   where p.share_slug = p_slug and p.is_shared = true
$function$;

GRANT ALL ON FUNCTION public.get_shared_preset(text) TO anon;

GRANT ALL ON FUNCTION public.get_shared_preset(text) TO authenticated;

CREATE FUNCTION public.get_world_rank()
  RETURNS TABLE (
    rank  bigint,
    total bigint
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select
    (select count(*) from public.profiles p
       where coalesce(p.xp, 0) > coalesce((select xp from public.profiles where id = auth.uid()), 0)
    ) + 1 as rank,
    (select count(*) from public.profiles) as total
$function$;

GRANT ALL ON FUNCTION public.get_world_rank() TO authenticated;

CREATE FUNCTION public.grant_campaign_rewards (
  p_user     uuid,
  p_campaign uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_best int;
  v_new jsonb;
begin
  select coalesce(best_stars, 0) into v_best
    from public.user_campaign_progress
   where user_id = p_user and campaign_id = p_campaign;
  if v_best is null then return '[]'::jsonb; end if;

  with granted as (
    insert into public.user_campaign_rewards (user_id, reward_id)
    select p_user, r.id
      from public.campaign_rewards r
     where r.campaign_id = p_campaign
       and r.required_stars <= v_best
    on conflict (user_id, reward_id) do nothing
    returning reward_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'kind', r.kind, 'rarity', r.rarity,
      'name', r.name, 'name_en', r.name_en, 'name_de', r.name_de,
      'description', r.description, 'description_en', r.description_en, 'description_de', r.description_de,
      'icon_url', r.icon_url, 'required_stars', r.required_stars
    )), '[]'::jsonb)
    into v_new
    from granted g join public.campaign_rewards r on r.id = g.reward_id;

  return coalesce(v_new, '[]'::jsonb);
end;
$function$;

CREATE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$function$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE FUNCTION public.increment_multiplayer_score (
  p_room_id uuid,
  p_user_id uuid,
  p_score   integer
)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  update public.multiplayer_players
  set total_score = coalesce(total_score, 0) + p_score
  where room_id = p_room_id and user_id = p_user_id;
$function$;

CREATE FUNCTION public.increment_user_score (
  p_user_id uuid,
  p_score   integer
)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  update public.profiles
     set total_score  = coalesce(total_score, 0)  + p_score,
         games_played = coalesce(games_played, 0) + 1
   where id = p_user_id;
$function$;

CREATE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $function$;

CREATE FUNCTION public.is_premium (
  p_user uuid DEFAULT auth.uid()
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select coalesce((
    select e.is_premium and (e.premium_until is null or e.premium_until > now())
    from public.user_entitlements e
    where e.user_id = p_user
  ), false)
$function$;

GRANT ALL ON FUNCTION public.is_premium(uuid) TO authenticated;

CREATE FUNCTION public.location_score_zones (
  p_over double precision
)
  RETURNS integer
  LANGUAGE sql
  IMMUTABLE
  AS $function$
  select case
    when p_over <= 250  then round(500 + (p_over - 0)    / (250  - 0)    * (450 - 500))
    when p_over <= 3000 then round(450 + (p_over - 250)  / (3000 - 250)  * (200 - 450))
    when p_over <= 5000 then round(200 + (p_over - 3000) / (5000 - 3000) * (0   - 200))
    else 0
  end::int
$function$;

CREATE FUNCTION public.maintain_multiplayer()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

GRANT ALL ON FUNCTION public.maintain_multiplayer() TO authenticated;

CREATE FUNCTION public.my_mistake_event_ids (
  p_max_score integer DEFAULT 500
)
  RETURNS uuid[]
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select coalesce(array_agg(distinct (r->>'event_id')::uuid), '{}')
    from public.game_sessions gs
    cross join lateral jsonb_array_elements(coalesce(gs.rounds, '[]'::jsonb)) r
   where gs.user_id = auth.uid()
     and gs.finished_at is not null
     and (r->>'round_score')::int < p_max_score
$function$;

GRANT ALL ON FUNCTION public.my_mistake_event_ids(integer) TO authenticated;

CREATE FUNCTION public.my_played_event_ids()
  RETURNS uuid[]
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select coalesce(array_agg(distinct (r->>'event_id')::uuid), '{}')
    from public.game_sessions gs
    cross join lateral jsonb_array_elements(coalesce(gs.rounds, '[]'::jsonb)) r
   where gs.user_id = auth.uid()
     and gs.finished_at is not null
$function$;

GRANT ALL ON FUNCTION public.my_played_event_ids() TO authenticated;

CREATE FUNCTION public.record_category_hit (
  p_event_id    uuid,
  p_round_score integer
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare v_cat text;
begin
  if auth.uid() is null or p_round_score < 950 then return; end if;
  select category into v_cat from public.events where id = p_event_id;
  if v_cat is null then return; end if;
  insert into public.user_category_hits (user_id, category, hits) values (auth.uid(), v_cat, 1)
  on conflict (user_id, category) do update set hits = public.user_category_hits.hits + 1;
end; $function$;

GRANT ALL ON FUNCTION public.record_category_hit(uuid, integer) TO authenticated;

CREATE FUNCTION public.record_event_score (
  p_event_id uuid,
  p_location integer,
  p_year     integer
)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  update public.events
     set play_count     = play_count + 1,
         score_count    = score_count + 1,
         score_sum      = score_sum + greatest(p_location,0) + greatest(p_year,0),
         score_loc_sum  = score_loc_sum + greatest(p_location,0),
         score_year_sum = score_year_sum + greatest(p_year,0)
   where id = p_event_id;
$function$;

GRANT ALL ON FUNCTION public.record_event_score(uuid, integer, integer) TO authenticated;

CREATE FUNCTION public.remaining_expeditions (
  p_user uuid DEFAULT auth.uid()
)
  RETURNS integer
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_free int; v_used int; v_bonus int;
begin
  if p_user is null then return 0; end if;
  if public.is_premium(p_user) then return -1; end if;
  if not public.config_bool('campaign_limit_enabled', true) then return -1; end if;

  v_free := public.config_int('free_expeditions_per_day', 5);
  select used_count, bonus_count into v_used, v_bonus
    from public.user_daily_campaign_usage
   where user_id = p_user and usage_date = v_today;

  return greatest(0, (v_free + coalesce(v_bonus, 0)) - coalesce(v_used, 0));
end;
$function$;

GRANT ALL ON FUNCTION public.remaining_expeditions(uuid) TO authenticated;

CREATE FUNCTION public.remove_friend (
  p_friend_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare v_me uuid := auth.uid();
begin
  if v_me is null then return; end if;
  delete from public.friendships
   where (requester_id = v_me and addressee_id = p_friend_id)
      or (requester_id = p_friend_id and addressee_id = v_me);
end;
$function$;

GRANT ALL ON FUNCTION public.remove_friend(uuid) TO authenticated;

CREATE FUNCTION public.report_categories()
  RETURNS TABLE (
    category text,
    plays    bigint
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select coalesce(e.category, '(bez kategorie)'), coalesce(sum(e.play_count), 0)::bigint
      from public.events e group by e.category order by 2 desc;
end; $function$;

GRANT ALL ON FUNCTION public.report_categories() TO authenticated;

CREATE FUNCTION public.report_daily_challenge (
  p_days integer
)
  RETURNS TABLE (
    day       date,
    players   integer,
    avg_score numeric
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    with days as (
      select generate_series(now()::date - (p_days - 1), now()::date, interval '1 day')::date as d
    )
    select d.d,
      (select count(*)::int from public.daily_results r where r.date = d.d),
      (select round(avg(r.score)) from public.daily_results r where r.date = d.d)
    from days d order by d.d;
end; $function$;

GRANT ALL ON FUNCTION public.report_daily_challenge(integer) TO authenticated;

CREATE FUNCTION public.report_daily_series (
  p_days integer
)
  RETURNS TABLE (
    day          date,
    new_users    integer,
    active_users integer,
    games        integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    with days as (
      select generate_series(now()::date - (p_days - 1), now()::date, interval '1 day')::date as d
    )
    select d.d,
      (select count(*)::int from public.profiles p where p.created_at::date = d.d),
      (select count(distinct ae.user_id)::int from public.analytics_events ae
         where ae.user_id is not null and ae.event_name in ('game_started','daily_challenge_started') and ae.created_at::date = d.d),
      (select count(*)::int from public.analytics_events ae
         where ae.event_name in ('game_completed','daily_challenge_completed') and ae.created_at::date = d.d)
    from days d order by d.d;
end; $function$;

GRANT ALL ON FUNCTION public.report_daily_series(integer) TO authenticated;

CREATE FUNCTION public.report_events_ranked()
  RETURNS TABLE (
    id         uuid,
    title      text,
    category   text,
    play_count integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select e.id, e.title, e.category, e.play_count
      from public.events e where e.published = true
      order by e.play_count desc limit 300;
end; $function$;

GRANT ALL ON FUNCTION public.report_events_ranked() TO authenticated;

CREATE FUNCTION public.report_multiplayer()
  RETURNS TABLE (
    metric text,
    value  numeric
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select 'rooms_total'::text, count(*)::numeric from public.multiplayer_rooms
    union all select 'rooms_finished', count(*) from public.multiplayer_rooms where status = 'finished'
    union all select 'mode_classic', count(*) from public.multiplayer_rooms where coalesce(settings->>'mode','classic') = 'classic'
    union all select 'mode_br', count(*) from public.multiplayer_rooms where settings->>'mode' = 'battle_royale'
    union all select 'avg_players', coalesce(round(avg(cnt), 1), 0) from (
      select count(*) cnt from public.multiplayer_players group by room_id
    ) s;
end; $function$;

GRANT ALL ON FUNCTION public.report_multiplayer() TO authenticated;

CREATE FUNCTION public.report_overview()
  RETURNS TABLE (
    metric text,
    value  numeric
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select 'registered'::text, count(*)::numeric from public.profiles
    union all select 'with_username', count(*) from public.profiles where username is not null
    union all select 'active_today', count(distinct user_id) from public.analytics_events
      where user_id is not null and event_name in ('game_started','daily_challenge_started') and created_at::date = now()::date
    union all select 'active_7d', count(distinct user_id) from public.analytics_events
      where user_id is not null and event_name in ('game_started','daily_challenge_started') and created_at >= now() - interval '7 days'
    union all select 'active_30d', count(distinct user_id) from public.analytics_events
      where user_id is not null and event_name in ('game_started','daily_challenge_started') and created_at >= now() - interval '30 days'
    union all select 'games_total', count(*) from public.analytics_events where event_name in ('game_completed','daily_challenge_completed')
    union all select 'daily_assigned', count(*) from public.daily_challenge_assignments where event_id is not null
    union all select 'events_published', count(*) from public.events where published = true
    union all select 'events_hidden', count(*) from public.events where published = false
    union all select 'events_no_panorama', count(*) from public.events where panorama_url is null or panorama_url in ('', 'pending')
    union all select 'events_no_translation', count(*) from public.events where title_en is null or title_de is null;
end; $function$;

GRANT ALL ON FUNCTION public.report_overview() TO authenticated;

CREATE FUNCTION public.respond_friend_request (
  p_requester uuid,
  p_accept    boolean
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare v_me uuid := auth.uid();
begin
  if v_me is null then return; end if;
  if p_accept then
    update public.friendships set status = 'accepted'
     where requester_id = p_requester and addressee_id = v_me and status = 'pending';
  else
    delete from public.friendships
     where requester_id = p_requester and addressee_id = v_me and status = 'pending';
  end if;
end;
$function$;

GRANT ALL ON FUNCTION public.respond_friend_request(uuid, boolean) TO authenticated;

CREATE FUNCTION public.score_event_guess (
  p_event_id   uuid,
  p_guess_lat  double precision,
  p_guess_lng  double precision,
  p_guess_year integer
)
  RETURNS TABLE (
    location_score integer,
    year_score     integer,
    round_score    integer,
    distance_km    double precision,
    year_diff      integer
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_lat double precision; v_lng double precision;
  v_yf int; v_yt int; v_radius double precision;
  v_a double precision; v_dist double precision; v_over double precision;
  v_loc int; v_year int; v_ydiff int;
begin
  select e.lat, e.lng,
         coalesce(e.year_from, e.year), coalesce(e.year_to, e.year),
         coalesce(e.location_radius_km, 0)
    into v_lat, v_lng, v_yf, v_yt, v_radius
    from public.events e
   where e.id = p_event_id;

  if v_lat is null then raise exception 'event_not_found'; end if;

  -- Chybějící tip = maximální penalizace (nedá se získat nic zadarmo)
  if p_guess_lat is null or p_guess_lng is null then
    v_dist := 20000;
  else
    v_a := sin(radians(p_guess_lat - v_lat)/2)^2
         + cos(radians(v_lat)) * cos(radians(p_guess_lat))
         * sin(radians(p_guess_lng - v_lng)/2)^2;
    v_dist := 6371 * 2 * atan2(sqrt(v_a), sqrt(1 - v_a));
  end if;

  v_over := greatest(0, v_dist - v_radius);
  v_loc := public.location_score_zones(v_over);

  if p_guess_year between v_yf and v_yt then
    v_year  := 500;
    v_ydiff := 0;
  else
    v_ydiff := case when p_guess_year < v_yf then v_yf - p_guess_year
                    else p_guess_year - v_yt end;
    v_year  := round(500 * exp(-v_ydiff / 240.0));
  end if;

  location_score := v_loc;
  year_score     := v_year;
  round_score    := v_loc + v_year;
  distance_km    := v_dist;
  year_diff      := v_ydiff;
  return next;
end;
$function$;

GRANT ALL ON FUNCTION public.score_event_guess(uuid, double precision, double precision, integer) TO authenticated;

CREATE FUNCTION public.send_friend_request (
  p_username text
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_me uuid := auth.uid();
  v_target uuid;
  v_existing record;
begin
  if v_me is null then return 'unauthorized'; end if;

  select id into v_target from public.profiles
   where lower(username) = lower(trim(p_username)) limit 1;

  if v_target is null then return 'not_found'; end if;
  if v_target = v_me then return 'self'; end if;

  select * into v_existing from public.friendships
   where (requester_id = v_me and addressee_id = v_target)
      or (requester_id = v_target and addressee_id = v_me)
   limit 1;

  if found then
    if v_existing.status = 'accepted' then
      return 'already_friends';
    end if;
    if v_existing.requester_id = v_target then
      update public.friendships set status = 'accepted'
       where requester_id = v_target and addressee_id = v_me;
      return 'accepted';
    end if;
    return 'pending';
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (v_me, v_target, 'pending');
  return 'sent';
end;
$function$;

GRANT ALL ON FUNCTION public.send_friend_request(text) TO authenticated;

CREATE FUNCTION public.set_preset_shared (
  p_preset_id uuid,
  p_shared    boolean
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_uid uuid := auth.uid();
  v_slug text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.single_player_presets
                  where id = p_preset_id and user_id = v_uid) then
    raise exception 'forbidden';
  end if;

  if not p_shared then
    update public.single_player_presets
       set is_shared = false, updated_at = now()
     where id = p_preset_id;
    return null;
  end if;

  select share_slug into v_slug from public.single_player_presets where id = p_preset_id;
  if v_slug is null then
    -- krátký náhodný slug (bez závislosti na rozšířeních)
    v_slug := lower(replace(encode(gen_random_bytes(6), 'base64'), '/', '_'));
    v_slug := replace(replace(v_slug, '+', '-'), '=', '');
  end if;

  update public.single_player_presets
     set is_shared = true, share_slug = v_slug, updated_at = now()
   where id = p_preset_id;
  return v_slug;
end;
$function$;

GRANT ALL ON FUNCTION public.set_preset_shared(uuid, boolean) TO authenticated;

CREATE FUNCTION public.start_campaign_attempt (
  p_campaign_id uuid
)
  RETURNS TABLE (
    attempt_id   uuid,
    rounds_total integer,
    event_ids    uuid[],
    energy_left  integer,
    resumed      boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
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
$function$;

GRANT ALL ON FUNCTION public.start_campaign_attempt(uuid) TO authenticated;

CREATE FUNCTION public.start_daily_challenge (
  p_date date
)
  RETURNS TABLE (
    started_at   timestamp with time zone,
    seconds_left integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_uid uuid := auth.uid();
  v_started timestamptz;
  v_limit int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.valid_daily_date(p_date) then raise exception 'invalid_date'; end if;

  insert into public.daily_starts (user_id, date) values (v_uid, p_date)
  on conflict (user_id, date) do nothing;

  select ds.started_at into v_started
    from public.daily_starts ds where ds.user_id = v_uid and ds.date = p_date;

  v_limit := public.config_int('daily_timer_seconds', 60);
  started_at   := v_started;
  seconds_left := greatest(0, v_limit - floor(extract(epoch from (now() - v_started)))::int);
  return next;
end;
$function$;

GRANT ALL ON FUNCTION public.start_daily_challenge(date) TO authenticated;

CREATE FUNCTION public.submit_campaign_round (
  p_attempt_id uuid,
  p_position   integer,
  p_guess_lat  double precision,
  p_guess_lng  double precision,
  p_guess_year integer
)
  RETURNS TABLE (
    location_score integer,
    year_score     integer,
    round_score    integer,
    distance_km    double precision,
    year_diff      integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_event uuid;
  v_answered timestamptz;
  v_loc int; v_year int; v_total int; v_dist double precision; v_yd int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select a.status into v_status from public.campaign_attempts a
   where a.id = p_attempt_id and a.user_id = v_uid;
  if v_status is null then raise exception 'attempt_not_found'; end if;
  if v_status <> 'in_progress' then raise exception 'attempt_not_active'; end if;

  select r.event_id, r.answered_at into v_event, v_answered
    from public.campaign_attempt_rounds r
   where r.attempt_id = p_attempt_id and r.position = p_position;
  if v_event is null then raise exception 'round_not_found'; end if;

  -- Idempotence: už zodpovězené kolo se NEPŘEPISUJE. Vrátíme uložené skóre
  -- a vzdálenost/rozdíl let dopočítáme z PŮVODNÍHO tipu (ne z nově poslaného).
  if v_answered is not null then
    return query
      select r.location_score, r.year_score, r.round_score, s.distance_km, s.year_diff
        from public.campaign_attempt_rounds r
        cross join lateral public.score_event_guess(r.event_id, r.guess_lat, r.guess_lng, r.guess_year) s
       where r.attempt_id = p_attempt_id and r.position = p_position;
    return;
  end if;

  select s.location_score, s.year_score, s.round_score, s.distance_km, s.year_diff
    into v_loc, v_year, v_total, v_dist, v_yd
    from public.score_event_guess(v_event, p_guess_lat, p_guess_lng, p_guess_year) s;

  update public.campaign_attempt_rounds
     set guess_lat = p_guess_lat, guess_lng = p_guess_lng, guess_year = p_guess_year,
         location_score = v_loc, year_score = v_year, round_score = v_total,
         answered_at = now()
   where attempt_id = p_attempt_id and position = p_position;

  location_score := v_loc; year_score := v_year; round_score := v_total;
  distance_km := v_dist; year_diff := v_yd;
  return next;
end;
$function$;

GRANT ALL ON FUNCTION public.submit_campaign_round(uuid, integer, double precision, double precision, integer) TO authenticated;

CREATE FUNCTION public.submit_daily_result (
  p_date       date,
  p_guess_lat  double precision,
  p_guess_lng  double precision,
  p_guess_year integer
)
  RETURNS TABLE (
    location_score integer,
    year_score     integer,
    round_score    integer,
    distance_km    double precision,
    year_diff      integer,
    xp_awarded     integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_uid uuid := auth.uid();
  v_event uuid;
  v_loc int; v_year int; v_total int; v_dist double precision; v_yd int;
  v_glat double precision; v_glng double precision; v_gyear int;
  v_started timestamptz; v_limit int; v_remain int; v_mult numeric := 1;
  v_xp int; v_inserted int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.valid_daily_date(p_date) then raise exception 'invalid_date'; end if;

  -- Pravda: událost přiřazená na tento den
  select a.event_id into v_event
    from public.daily_challenge_assignments a
   where a.month = extract(month from p_date)::int
     and a.day = extract(day from p_date)::int;
  if v_event is null then raise exception 'no_challenge'; end if;

  -- Už odehráno → přepočti z ULOŽENÉHO tipu a vrať (idempotence, bez další XP)
  select dr.guess_lat, dr.guess_lng, dr.guess_year
    into v_glat, v_glng, v_gyear
    from public.daily_results dr
   where dr.user_id = v_uid and dr.date = p_date;
  if found then
    select s.location_score, s.year_score, s.round_score, s.distance_km, s.year_diff
      into v_loc, v_year, v_total, v_dist, v_yd
      from public.score_event_guess(v_event, v_glat, v_glng, v_gyear) s;
    location_score := v_loc; year_score := v_year; round_score := v_total;
    distance_km := v_dist; year_diff := v_yd; xp_awarded := 0;
    return next;
    return;
  end if;

  select s.location_score, s.year_score, s.round_score, s.distance_km, s.year_diff
    into v_loc, v_year, v_total, v_dist, v_yd
    from public.score_event_guess(v_event, p_guess_lat, p_guess_lng, p_guess_year) s;

  -- XP násobič ze SERVEROVÉHO času startu (čas/10, jen když zbývá ≥ 10 s)
  v_limit := public.config_int('daily_timer_seconds', 60);
  select ds.started_at into v_started
    from public.daily_starts ds where ds.user_id = v_uid and ds.date = p_date;
  if v_started is not null then
    v_remain := greatest(0, v_limit - floor(extract(epoch from (now() - v_started)))::int);
    if v_remain >= 10 then v_mult := v_remain / 10.0; end if;
  end if;
  -- strop dle délky kola (nikdy víc, než kolik jde reálně stihnout)
  v_mult := least(v_mult, greatest(1, v_limit / 10.0));

  insert into public.daily_results (user_id, date, score, guess_lat, guess_lng, guess_year)
  values (v_uid, p_date, v_total, p_guess_lat, p_guess_lng, p_guess_year)
  on conflict (user_id, date) do nothing;
  get diagnostics v_inserted = row_count;

  v_xp := 0;
  if v_inserted = 1 then
    -- XP: (skóre + bonus) × násobič za rychlost. Bonus musí sedět s leveling.ts.
    v_xp := round((v_total + 300) * v_mult);
    perform public.add_xp(v_uid, v_xp);
  end if;

  location_score := v_loc; year_score := v_year; round_score := v_total;
  distance_km := v_dist; year_diff := v_yd; xp_awarded := v_xp;
  return next;
end;
$function$;

GRANT ALL ON FUNCTION public.submit_daily_result(date, double precision, double precision, integer) TO authenticated;

CREATE FUNCTION public.submit_game_session (
  p_session_id uuid,
  p_guesses    jsonb
)
  RETURNS TABLE (
    total_score integer,
    xp_awarded  integer,
    rounds      jsonb
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_uid uuid := auth.uid();
  v_owner uuid; v_finished timestamptz;
  g jsonb;
  v_lat double precision; v_lng double precision; v_year int; v_event uuid;
  v_loc int; v_yr int; v_tot int; v_dist double precision; v_yd int;
  v_rounds jsonb := '[]'::jsonb;
  v_total int := 0;
  v_xp int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select gs.user_id, gs.finished_at into v_owner, v_finished
    from public.game_sessions gs where gs.id = p_session_id;
  if v_owner is null then raise exception 'session_not_found'; end if;
  if v_owner <> v_uid then raise exception 'forbidden'; end if;

  -- Idempotence: dokončenou hru už nepřepočítáváme ani znovu neodměňujeme
  if v_finished is not null then
    return query select gs.total_score, 0, gs.rounds
      from public.game_sessions gs where gs.id = p_session_id;
    return;
  end if;

  if jsonb_typeof(p_guesses) <> 'array' or jsonb_array_length(p_guesses) = 0 then
    raise exception 'no_rounds';
  end if;

  for g in select * from jsonb_array_elements(p_guesses) loop
    v_event := (g->>'event_id')::uuid;
    v_lat   := nullif(g->>'lat', '')::double precision;
    v_lng   := nullif(g->>'lng', '')::double precision;
    v_year  := coalesce((g->>'year')::int, 0);

    select s.location_score, s.year_score, s.round_score, s.distance_km, s.year_diff
      into v_loc, v_yr, v_tot, v_dist, v_yd
      from public.score_event_guess(v_event, v_lat, v_lng, v_year) s;

    v_total := v_total + v_tot;
    v_rounds := v_rounds || jsonb_build_object(
      'event_id', v_event, 'guess_lat', v_lat, 'guess_lng', v_lng, 'guess_year', v_year,
      'distance_km', v_dist, 'year_diff', v_yd,
      'location_score', v_loc, 'year_score', v_yr, 'round_score', v_tot
    );
  end loop;

  update public.game_sessions
     set rounds = v_rounds, total_score = v_total, finished_at = now()
   where id = p_session_id;

  -- XP: body + bonus za dohranou hru (musí sedět s leveling.ts)
  v_xp := v_total + 500;
  perform public.add_xp(v_uid, v_xp);
  perform public.increment_user_score(v_uid, v_total);

  total_score := v_total; xp_awarded := v_xp; rounds := v_rounds;
  return next;
end;
$function$;

GRANT ALL ON FUNCTION public.submit_game_session(uuid, jsonb) TO authenticated;

CREATE FUNCTION public.submit_multiplayer_answer (
  p_room_id      uuid,
  p_round_number integer,
  p_guess_lat    double precision,
  p_guess_lng    double precision,
  p_guess_year   integer
)
  RETURNS TABLE (
    location_score integer,
    year_score     integer,
    round_score    integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_uid uuid := auth.uid();
  v_event_id uuid;
  v_loc int; v_year int; v_total int;
  v_inserted int;
begin
  if v_uid is null or not exists (
    select 1 from public.multiplayer_players
     where room_id = p_room_id and user_id = v_uid
  ) then
    raise exception 'not a participant';
  end if;

  select r.event_id into v_event_id
    from public.multiplayer_rounds r
   where r.room_id = p_room_id and r.round_number = p_round_number;
  if v_event_id is null then raise exception 'round not found'; end if;

  select s.location_score, s.year_score, s.round_score
    into v_loc, v_year, v_total
    from public.score_event_guess(v_event_id, p_guess_lat, p_guess_lng, p_guess_year) s;

  insert into public.multiplayer_answers
    (room_id, round_number, user_id, guess_lat, guess_lng, guess_year,
     location_score, year_score, round_score)
  values
    (p_room_id, p_round_number, v_uid, p_guess_lat, p_guess_lng, p_guess_year,
     v_loc, v_year, v_total)
  on conflict (room_id, round_number, user_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    update public.multiplayer_players
       set total_score = coalesce(total_score, 0) + v_total
     where room_id = p_room_id and user_id = v_uid;
    -- XP z OVĚŘENÉHO skóre (dřív si ho posílal klient sám)
    perform public.add_xp(v_uid, v_total);
  end if;

  location_score := v_loc;
  year_score := v_year;
  round_score := v_total;
  return next;
end;
$function$;

GRANT ALL ON FUNCTION public.submit_multiplayer_answer(uuid, integer, double precision, double precision, integer) TO authenticated;

CREATE FUNCTION public.update_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE FUNCTION public.user_category_stars (
  p_category uuid,
  p_user     uuid DEFAULT auth.uid()
)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select coalesce(sum(p.best_stars), 0)::int
    from public.user_campaign_progress p
    join public.campaigns c on c.id = p.campaign_id
   where p.user_id = p_user and c.category_id = p_category
$function$;

GRANT ALL ON FUNCTION public.user_category_stars(uuid, uuid) TO authenticated;

CREATE FUNCTION public.user_global_stars (
  p_user uuid DEFAULT auth.uid()
)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select coalesce(sum(best_stars), 0)::int from public.user_campaign_progress where user_id = p_user
$function$;

GRANT ALL ON FUNCTION public.user_global_stars(uuid) TO authenticated;

CREATE FUNCTION public.valid_daily_date (
  p_date date
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  AS $function$
  select p_date between ((now() at time zone 'utc')::date - 1)
                    and ((now() at time zone 'utc')::date + 1)
$function$;

CREATE FUNCTION public.validate_game_session()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
declare
  computed_score int;
begin
  -- Spočítej součet round_score z jsonb
  select coalesce(sum((r->>'round_score')::int), 0)
  into computed_score
  from jsonb_array_elements(new.rounds) as r;

  -- Maximální skóre za kolo je 10 000, max 5 kol
  if new.total_score > 50000 then
    raise exception 'Neplatné skóre: překračuje maximum';
  end if;

  -- Skóre musí odpovídat součtu kol (tolerance ±1 kvůli zaokrouhlování)
  if new.total_score is not null and abs(new.total_score - computed_score) > 1 then
    raise exception 'Neplatné skóre: neshoduje se se součtem kol';
  end if;

  return new;
end;
$function$;

CREATE TABLE public.analytics_events (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id    uuid,
  event_name text                     NOT NULL,
  properties jsonb                    DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.analytics_events
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.analytics_events
  ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);

GRANT INSERT ON public.analytics_events TO anon;

GRANT INSERT ON public.analytics_events TO authenticated;

CREATE INDEX analytics_events_name_time ON public.analytics_events (event_name, created_at DESC);

CREATE POLICY "analytics insert" ON public.analytics_events
  FOR INSERT
  WITH CHECK (((auth.uid() = user_id) OR (user_id IS NULL)));

CREATE POLICY "analytics: admin select" ON public.analytics_events
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "analytics: insert own" ON public.analytics_events
  FOR INSERT
  WITH CHECK (((user_id IS NULL) OR (auth.uid() = user_id)));

CREATE TABLE public.app_config (
  key        text                     NOT NULL,
  value      jsonb                    NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.app_config
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.app_config
  ADD CONSTRAINT app_config_pkey PRIMARY KEY (key);

GRANT SELECT ON public.app_config TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.app_config TO authenticated;

CREATE POLICY "cfg: read all" ON public.app_config
  FOR SELECT
  USING (true);

CREATE TABLE public.campaign_attempt_rounds (
  attempt_id     uuid                     NOT NULL,
  "position"     integer                  NOT NULL,
  event_id       uuid                     NOT NULL,
  guess_lat      double precision,
  guess_lng      double precision,
  guess_year     integer,
  location_score integer,
  year_score     integer,
  round_score    integer,
  answered_at    timestamp with time zone
);

ALTER TABLE public.campaign_attempt_rounds
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.campaign_attempt_rounds
  ADD CONSTRAINT campaign_attempt_rounds_pkey PRIMARY KEY (attempt_id, "position");

GRANT SELECT ON public.campaign_attempt_rounds TO authenticated;

CREATE TABLE public.campaign_attempts (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id      uuid                     NOT NULL,
  campaign_id  uuid                     NOT NULL,
  status       text                     DEFAULT 'in_progress'::text NOT NULL,
  rounds_total integer                  NOT NULL,
  total_score  integer                  DEFAULT 0 NOT NULL,
  stars        integer                  DEFAULT 0 NOT NULL,
  started_at   timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone,
  expires_at   timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL
);

CREATE POLICY "attr: select own" ON public.campaign_attempt_rounds
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM public.campaign_attempts a
  WHERE ((a.id = campaign_attempt_rounds.attempt_id) AND (a.user_id = auth.uid())))));

ALTER TABLE public.campaign_attempts
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.campaign_attempts
  ADD CONSTRAINT campaign_attempts_pkey PRIMARY KEY (id);

ALTER TABLE public.campaign_attempt_rounds
  ADD CONSTRAINT campaign_attempt_rounds_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.campaign_attempts(id) ON DELETE CASCADE;

ALTER TABLE public.campaign_attempts
  ADD CONSTRAINT campaign_attempts_stars_check CHECK (stars >= 0 AND stars <= 3);

ALTER TABLE public.campaign_attempts
  ADD CONSTRAINT campaign_attempts_status_check CHECK (status = ANY (ARRAY['created'::text, 'in_progress'::text, 'completed'::text, 'abandoned'::text, 'expired'::text]));

ALTER TABLE public.campaign_attempts
  ADD CONSTRAINT campaign_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

GRANT SELECT ON public.campaign_attempts TO authenticated;

CREATE UNIQUE INDEX uq_attempt_active ON public.campaign_attempts (user_id, campaign_id)
  WHERE status = 'in_progress'::text;

CREATE INDEX idx_attempts_user_campaign ON public.campaign_attempts (user_id, campaign_id);

CREATE POLICY "att: select own" ON public.campaign_attempts
  FOR SELECT
  USING ((auth.uid() = user_id));

CREATE TABLE public.campaign_categories (
  id                    uuid                     DEFAULT gen_random_uuid() NOT NULL,
  seq                   integer                  DEFAULT 0 NOT NULL,
  slug                  text,
  title                 text                     NOT NULL,
  title_en              text,
  title_de              text,
  description           text,
  description_en        text,
  description_de        text,
  icon                  text,
  color                 text,
  hero_image_url        text,
  required_global_stars integer                  DEFAULT 0 NOT NULL,
  is_premium            boolean                  DEFAULT false NOT NULL,
  status                text                     DEFAULT 'draft'::text NOT NULL,
  published_at          timestamp with time zone,
  created_at            timestamp with time zone DEFAULT now() NOT NULL,
  updated_at            timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.campaign_categories
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.campaign_categories
  ADD CONSTRAINT campaign_categories_pkey PRIMARY KEY (id);

ALTER TABLE public.campaign_categories
  ADD CONSTRAINT campaign_categories_required_global_stars_check CHECK (required_global_stars >= 0);

ALTER TABLE public.campaign_categories
  ADD CONSTRAINT campaign_categories_slug_key UNIQUE (slug);

ALTER TABLE public.campaign_categories
  ADD CONSTRAINT campaign_categories_status_check CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]));

GRANT SELECT ON public.campaign_categories TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.campaign_categories TO authenticated;

CREATE TABLE public.campaign_events (
  campaign_id uuid    NOT NULL,
  "position"  integer NOT NULL,
  event_id    uuid    NOT NULL,
  is_active   boolean DEFAULT true NOT NULL,
  admin_note  text
);

ALTER TABLE public.campaign_events
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.campaign_events
  ADD CONSTRAINT campaign_events_pkey PRIMARY KEY (campaign_id, "position");

ALTER TABLE public.campaign_events
  ADD CONSTRAINT campaign_events_position_check CHECK ("position" >= 1);

ALTER TABLE public.campaign_events
  ADD CONSTRAINT uq_campaign_event UNIQUE (campaign_id, event_id);

GRANT SELECT ON public.campaign_events TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.campaign_events TO authenticated;

CREATE INDEX idx_campaign_events_event ON public.campaign_events (event_id);

CREATE TRIGGER trg_campaign_events_demote
  AFTER INSERT OR DELETE OR UPDATE ON public.campaign_events
  FOR EACH ROW
  EXECUTE FUNCTION public.demote_broken_campaign();

CREATE TABLE public.campaign_rewards (
  id             uuid                     DEFAULT gen_random_uuid() NOT NULL,
  campaign_id    uuid                     NOT NULL,
  kind           text                     DEFAULT 'artifact'::text NOT NULL,
  required_stars integer                  DEFAULT 0 NOT NULL,
  name           text                     NOT NULL,
  name_en        text,
  name_de        text,
  description    text,
  description_en text,
  description_de text,
  icon_url       text,
  rarity         text                     DEFAULT 'common'::text NOT NULL,
  created_at     timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.campaign_rewards
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.campaign_rewards
  ADD CONSTRAINT campaign_rewards_kind_check CHECK (kind = ANY (ARRAY['artifact'::text, 'badge'::text, 'title'::text]));

ALTER TABLE public.campaign_rewards
  ADD CONSTRAINT campaign_rewards_pkey PRIMARY KEY (id);

ALTER TABLE public.campaign_rewards
  ADD CONSTRAINT campaign_rewards_rarity_check CHECK (rarity = ANY (ARRAY['common'::text, 'rare'::text, 'epic'::text, 'legendary'::text]));

ALTER TABLE public.campaign_rewards
  ADD CONSTRAINT campaign_rewards_required_stars_check CHECK (required_stars >= 0 AND required_stars <= 3);

ALTER TABLE public.campaign_rewards
  ADD CONSTRAINT uq_reward_campaign_stars UNIQUE (campaign_id, required_stars);

GRANT SELECT ON public.campaign_rewards TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.campaign_rewards TO authenticated;

CREATE INDEX idx_campaign_rewards_campaign ON public.campaign_rewards (campaign_id);

CREATE TABLE public.campaigns (
  id                      uuid                     DEFAULT gen_random_uuid() NOT NULL,
  category_id             uuid                     NOT NULL,
  seq                     integer                  DEFAULT 0 NOT NULL,
  slug                    text,
  title                   text                     NOT NULL,
  title_en                text,
  title_de                text,
  description             text,
  description_en          text,
  description_de          text,
  visual_url              text,
  rounds_count            integer                  DEFAULT 5 NOT NULL,
  star_thresholds_pct     jsonb,
  required_category_stars integer                  DEFAULT 0 NOT NULL,
  is_premium              boolean                  DEFAULT false NOT NULL,
  status                  text                     DEFAULT 'draft'::text NOT NULL,
  published_at            timestamp with time zone,
  created_at              timestamp with time zone DEFAULT now() NOT NULL,
  updated_at              timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.campaigns
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.campaign_categories(id) ON DELETE CASCADE;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);

ALTER TABLE public.campaign_attempts
  ADD CONSTRAINT campaign_attempts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;

ALTER TABLE public.campaign_events
  ADD CONSTRAINT campaign_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;

ALTER TABLE public.campaign_rewards
  ADD CONSTRAINT campaign_rewards_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_required_category_stars_check CHECK (required_category_stars >= 0);

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_rounds_count_check CHECK (rounds_count >= 1 AND rounds_count <= 20);

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_slug_key UNIQUE (slug);

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_status_check CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]));

GRANT SELECT ON public.campaigns TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.campaigns TO authenticated;

CREATE INDEX idx_campaigns_category ON public.campaigns (category_id);

CREATE TRIGGER trg_campaign_publishable
  BEFORE INSERT OR UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_campaign_publishable();

CREATE TABLE public.daily_challenge_assignments (
  month      integer                  NOT NULL,
  day        integer                  NOT NULL,
  event_id   uuid,
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.daily_challenge_assignments
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.daily_challenge_assignments
  ADD CONSTRAINT daily_challenge_assignments_day_check CHECK (day >= 1 AND day <= 31);

ALTER TABLE public.daily_challenge_assignments
  ADD CONSTRAINT daily_challenge_assignments_month_check CHECK (month >= 1 AND month <= 12);

ALTER TABLE public.daily_challenge_assignments
  ADD CONSTRAINT daily_challenge_assignments_pkey PRIMARY KEY (month, day);

GRANT SELECT ON public.daily_challenge_assignments TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.daily_challenge_assignments TO authenticated;

CREATE POLICY "daily_assign: admin write" ON public.daily_challenge_assignments
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "daily_assign: public select" ON public.daily_challenge_assignments
  FOR SELECT
  USING (true);

CREATE POLICY "daily_assignments read" ON public.daily_challenge_assignments
  FOR SELECT
  USING (true);

CREATE TABLE public.daily_results (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id    uuid,
  date       date                     NOT NULL,
  score      integer                  DEFAULT 0 NOT NULL,
  guess_lat  double precision,
  guess_lng  double precision,
  guess_year integer,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.daily_results
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.daily_results
  ADD CONSTRAINT daily_results_pkey PRIMARY KEY (id);

ALTER TABLE public.daily_results
  ADD CONSTRAINT daily_results_user_date_key UNIQUE (user_id, date);

ALTER TABLE public.daily_results
  ADD CONSTRAINT daily_results_user_id_date_key UNIQUE (user_id, date);

GRANT SELECT ON public.daily_results TO anon;

GRANT INSERT, SELECT ON public.daily_results TO authenticated;

CREATE INDEX daily_results_date_score ON public.daily_results (date, score DESC);

CREATE POLICY "daily_results insert own" ON public.daily_results
  FOR INSERT
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "daily_results read" ON public.daily_results
  FOR SELECT
  USING (true);

CREATE POLICY "daily_results: public select" ON public.daily_results
  FOR SELECT
  USING (true);

CREATE TABLE public.daily_starts (
  user_id    uuid                     NOT NULL,
  date       date                     NOT NULL,
  started_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.daily_starts
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.daily_starts
  ADD CONSTRAINT daily_starts_pkey PRIMARY KEY (user_id, date);

ALTER TABLE public.daily_starts
  ADD CONSTRAINT daily_starts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

GRANT SELECT ON public.daily_starts TO authenticated;

CREATE POLICY "dstart: select own" ON public.daily_starts
  FOR SELECT
  USING ((auth.uid() = user_id));

CREATE TABLE public.entitlement_audit (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id    uuid                     NOT NULL,
  action     text                     NOT NULL,
  actor_id   uuid,
  before     jsonb,
  after      jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.entitlement_audit
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.entitlement_audit
  ADD CONSTRAINT entitlement_audit_pkey PRIMARY KEY (id);

GRANT SELECT ON public.entitlement_audit TO authenticated;

CREATE INDEX idx_entitlement_audit_user ON public.entitlement_audit (user_id, created_at DESC);

CREATE TABLE public.events (
  id                    uuid                     DEFAULT gen_random_uuid() NOT NULL,
  title                 text                     NOT NULL,
  description           text                     NOT NULL,
  year                  integer                  NOT NULL,
  lat                   double precision         NOT NULL,
  lng                   double precision         NOT NULL,
  panorama_url          text                     NOT NULL,
  event_image_url       text,
  category              text,
  difficulty            integer                  DEFAULT 2 NOT NULL,
  published             boolean                  DEFAULT false NOT NULL,
  play_count            integer                  DEFAULT 0 NOT NULL,
  created_by            uuid,
  created_at            timestamp with time zone DEFAULT now() NOT NULL,
  updated_at            timestamp with time zone DEFAULT now() NOT NULL,
  location_radius_km    integer                  DEFAULT 0 NOT NULL,
  year_range            integer                  DEFAULT 0 NOT NULL,
  rating_sum            integer                  DEFAULT 0 NOT NULL,
  rating_count          integer                  DEFAULT 0 NOT NULL,
  year_from             integer                  NOT NULL,
  year_to               integer                  NOT NULL,
  hfov                  integer                  DEFAULT 100 NOT NULL,
  score_count           integer                  DEFAULT 0 NOT NULL,
  score_sum             bigint                   DEFAULT 0 NOT NULL,
  score_loc_sum         bigint                   DEFAULT 0 NOT NULL,
  score_year_sum        bigint                   DEFAULT 0 NOT NULL,
  seq                   integer                  DEFAULT nextval('public.events_seq_seq'::regclass) NOT NULL,
  title_en              text,
  title_de              text,
  description_en        text,
  description_de        text,
  preview_url           text,
  event_date            date,
  status                text                     DEFAULT 'draft'::text NOT NULL,
  panorama_prompt       text,
  continent             text,
  continent_source      text                     DEFAULT 'auto'::text NOT NULL,
  continent_computed_at timestamp with time zone
);

ALTER SEQUENCE public.events_seq_seq OWNED BY public.events.seq;

GRANT SELECT, USAGE ON SEQUENCE public.events_seq_seq TO authenticated;

ALTER TABLE public.events
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.events
  ADD CONSTRAINT events_continent_check
    CHECK
    (continent IS NULL OR (continent = ANY (ARRAY['Europe'::text, 'Asia'::text, 'Africa'::text, 'North America'::text, 'South America'::text, 'Oceania'::text,
    'Antarctica'::text])));

ALTER TABLE public.events
  ADD CONSTRAINT events_continent_source_check CHECK (continent_source = ANY (ARRAY['auto'::text, 'manual'::text]));

ALTER TABLE public.events
  ADD CONSTRAINT events_difficulty_check CHECK (difficulty >= 1 AND difficulty <= 3);

ALTER TABLE public.events
  ADD CONSTRAINT events_pkey PRIMARY KEY (id);

ALTER TABLE public.campaign_attempt_rounds
  ADD CONSTRAINT campaign_attempt_rounds_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE RESTRICT;

ALTER TABLE public.campaign_events
  ADD CONSTRAINT campaign_events_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE RESTRICT;

ALTER TABLE public.daily_challenge_assignments
  ADD CONSTRAINT daily_challenge_assignments_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE public.events
  ADD CONSTRAINT events_status_chk CHECK (status = ANY (ARRAY['draft'::text, 'awaiting_panorama'::text, 'awaiting_review'::text, 'published'::text]));

GRANT SELECT ON public.events TO anon;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.events TO authenticated;

CREATE UNIQUE INDEX events_seq_key ON public.events (seq);

CREATE INDEX events_status_idx ON public.events (status);

CREATE INDEX idx_events_continent ON public.events (continent)
  WHERE continent IS NOT NULL;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE POLICY "events: admin delete" ON public.events
  FOR DELETE
  USING (public.is_admin());

CREATE POLICY "events: admin insert" ON public.events
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "events: admin select all" ON public.events
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "events: admin update" ON public.events
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "events: public select published" ON public.events
  FOR SELECT
  USING ((published = true));

CREATE TABLE public.friendships (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  requester_id uuid                     NOT NULL,
  addressee_id uuid                     NOT NULL,
  status       text                     DEFAULT 'pending'::text NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.friendships
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.friendships
  ADD CONSTRAINT friendships_pkey PRIMARY KEY (id);

ALTER TABLE public.friendships
  ADD CONSTRAINT friendships_requester_id_addressee_id_key UNIQUE (requester_id, addressee_id);

CREATE TABLE public.game_sessions (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id     uuid                     NOT NULL,
  started_at  timestamp with time zone DEFAULT now() NOT NULL,
  finished_at timestamp with time zone,
  total_score integer,
  rounds      jsonb                    DEFAULT '[]'::jsonb NOT NULL,
  mode        text                     DEFAULT 'classic'::text NOT NULL
);

ALTER TABLE public.game_sessions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.game_sessions
  ADD CONSTRAINT game_sessions_mode_check CHECK (mode = 'classic'::text);

ALTER TABLE public.game_sessions
  ADD CONSTRAINT game_sessions_pkey PRIMARY KEY (id);

GRANT INSERT, SELECT, UPDATE ON public.game_sessions TO authenticated;

CREATE TRIGGER validate_game_session_score
  BEFORE INSERT OR UPDATE ON public.game_sessions
  FOR EACH ROW
  WHEN (new.finished_at IS NOT NULL)
  EXECUTE FUNCTION public.validate_game_session();

CREATE POLICY "sessions: insert own" ON public.game_sessions
  FOR INSERT
  WITH CHECK (((auth.uid() = user_id) AND (total_score IS NULL) AND (finished_at IS NULL)));

CREATE POLICY "sessions: select own" ON public.game_sessions
  FOR SELECT
  USING ((auth.uid() = user_id));

CREATE TABLE public.mp_maintenance (
  id       boolean                  DEFAULT true NOT NULL,
  last_run timestamp with time zone
);

ALTER TABLE public.mp_maintenance
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.mp_maintenance
  ADD CONSTRAINT mp_maintenance_id_check CHECK (id);

ALTER TABLE public.mp_maintenance
  ADD CONSTRAINT mp_maintenance_pkey PRIMARY KEY (id);

CREATE TABLE public.multiplayer_answers (
  room_id        uuid                     NOT NULL,
  round_number   integer                  NOT NULL,
  user_id        uuid                     NOT NULL,
  guess_lat      double precision         DEFAULT 0 NOT NULL,
  guess_lng      double precision         DEFAULT 0 NOT NULL,
  guess_year     integer                  DEFAULT 0 NOT NULL,
  location_score integer                  DEFAULT 0 NOT NULL,
  year_score     integer                  DEFAULT 0 NOT NULL,
  round_score    integer                  DEFAULT 0 NOT NULL,
  submitted_at   timestamp with time zone DEFAULT now()
);

ALTER TABLE public.multiplayer_answers
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.multiplayer_answers
  REPLICA IDENTITY FULL;

ALTER TABLE public.multiplayer_answers
  ADD CONSTRAINT multiplayer_answers_pkey PRIMARY KEY (room_id, round_number, user_id);

GRANT DELETE, INSERT, SELECT, UPDATE ON public.multiplayer_answers TO authenticated;

CREATE INDEX multiplayer_answers_room_id_round_number_idx ON public.multiplayer_answers (room_id, round_number);

CREATE POLICY "answers insert" ON public.multiplayer_answers
  FOR INSERT
  WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "answers read" ON public.multiplayer_answers
  FOR SELECT
  USING (true);

CREATE POLICY "answers: select authenticated" ON public.multiplayer_answers
  FOR SELECT
  USING ((auth.uid() IS NOT NULL));

CREATE TABLE public.multiplayer_players (
  room_id          uuid                     NOT NULL,
  user_id          uuid                     NOT NULL,
  username         text                     NOT NULL,
  total_score      integer                  DEFAULT 0 NOT NULL,
  is_host          boolean                  DEFAULT false NOT NULL,
  joined_at        timestamp with time zone DEFAULT now(),
  eliminated       boolean                  DEFAULT false NOT NULL,
  eliminated_round integer
);

ALTER TABLE public.multiplayer_players
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.multiplayer_players
  REPLICA IDENTITY FULL;

ALTER TABLE public.multiplayer_players
  ADD CONSTRAINT multiplayer_players_pkey PRIMARY KEY (room_id, user_id);

GRANT DELETE, INSERT, SELECT, UPDATE ON public.multiplayer_players TO authenticated;

CREATE INDEX multiplayer_players_room_id_idx ON public.multiplayer_players (room_id);

CREATE POLICY "players delete" ON public.multiplayer_players
  FOR DELETE
  USING ((auth.uid() = user_id));

CREATE POLICY "players insert" ON public.multiplayer_players
  FOR INSERT
  WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "players read" ON public.multiplayer_players
  FOR SELECT
  USING (true);

CREATE POLICY "players: insert own" ON public.multiplayer_players
  FOR INSERT
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "players: select authenticated" ON public.multiplayer_players
  FOR SELECT
  USING ((auth.uid() IS NOT NULL));

CREATE TABLE public.multiplayer_rooms (
  id            uuid                     DEFAULT gen_random_uuid() NOT NULL,
  code          character(5)             NOT NULL,
  host_id       uuid,
  status        text                     DEFAULT 'waiting'::text NOT NULL,
  current_round integer                  DEFAULT 0 NOT NULL,
  settings      jsonb                    DEFAULT '{"rounds": 5, "year_to": 2025, "year_from": -3000, "categories": [], "time_limit": 60}'::jsonb NOT NULL,
  created_at    timestamp with time zone DEFAULT now(),
  updated_at    timestamp with time zone DEFAULT now()
);

CREATE POLICY "players: host manage" ON public.multiplayer_players
  USING ((EXISTS ( SELECT 1
   FROM public.multiplayer_rooms r
  WHERE ((r.id = multiplayer_players.room_id) AND (r.host_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.multiplayer_rooms r
  WHERE ((r.id = multiplayer_players.room_id) AND (r.host_id = auth.uid())))));

ALTER TABLE public.multiplayer_rooms
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.multiplayer_rooms
  REPLICA IDENTITY FULL;

ALTER TABLE public.multiplayer_rooms
  ADD CONSTRAINT multiplayer_rooms_code_key UNIQUE (code);

ALTER TABLE public.multiplayer_rooms
  ADD CONSTRAINT multiplayer_rooms_pkey PRIMARY KEY (id);

ALTER TABLE public.multiplayer_answers
  ADD CONSTRAINT multiplayer_answers_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.multiplayer_rooms(id) ON DELETE CASCADE;

ALTER TABLE public.multiplayer_players
  ADD CONSTRAINT multiplayer_players_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.multiplayer_rooms(id) ON DELETE CASCADE;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.multiplayer_rooms TO authenticated;

CREATE INDEX idx_mp_rooms_updated ON public.multiplayer_rooms (updated_at);

CREATE INDEX multiplayer_rooms_code_idx ON public.multiplayer_rooms (code);

CREATE INDEX idx_mp_rooms_status_updated ON public.multiplayer_rooms (status, updated_at);

CREATE POLICY "rooms insert" ON public.multiplayer_rooms
  FOR INSERT
  WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "rooms read" ON public.multiplayer_rooms
  FOR SELECT
  USING (true);

CREATE POLICY "rooms update" ON public.multiplayer_rooms
  FOR UPDATE
  USING ((auth.uid() = host_id));

CREATE POLICY "rooms: host delete" ON public.multiplayer_rooms
  FOR DELETE
  USING ((auth.uid() = host_id));

CREATE POLICY "rooms: host update" ON public.multiplayer_rooms
  FOR UPDATE
  USING ((auth.uid() = host_id))
  WITH CHECK ((auth.uid() = host_id));

CREATE POLICY "rooms: insert as host" ON public.multiplayer_rooms
  FOR INSERT
  WITH CHECK ((auth.uid() = host_id));

CREATE POLICY "rooms: select authenticated" ON public.multiplayer_rooms
  FOR SELECT
  USING ((auth.uid() IS NOT NULL));

CREATE TABLE public.multiplayer_rounds (
  room_id      uuid                     NOT NULL,
  round_number integer                  NOT NULL,
  event_id     uuid,
  started_at   timestamp with time zone
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_answers, TABLE public.multiplayer_players, TABLE public.multiplayer_rooms, TABLE public.multiplayer_rounds;

ALTER TABLE public.multiplayer_rounds
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.multiplayer_rounds
  REPLICA IDENTITY FULL;

ALTER TABLE public.multiplayer_rounds
  ADD CONSTRAINT multiplayer_rounds_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id);

ALTER TABLE public.multiplayer_rounds
  ADD CONSTRAINT multiplayer_rounds_pkey PRIMARY KEY (room_id, round_number);

ALTER TABLE public.multiplayer_rounds
  ADD CONSTRAINT multiplayer_rounds_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.multiplayer_rooms(id) ON DELETE CASCADE;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.multiplayer_rounds TO authenticated;

CREATE POLICY "rounds insert" ON public.multiplayer_rounds
  FOR INSERT
  WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "rounds read" ON public.multiplayer_rounds
  FOR SELECT
  USING (true);

CREATE POLICY "rounds update" ON public.multiplayer_rounds
  FOR UPDATE
  USING ((auth.uid() = ( SELECT multiplayer_rooms.host_id
   FROM public.multiplayer_rooms
  WHERE (multiplayer_rooms.id = multiplayer_rounds.room_id))));

CREATE POLICY "rounds: host write" ON public.multiplayer_rounds
  USING ((EXISTS ( SELECT 1
   FROM public.multiplayer_rooms r
  WHERE ((r.id = multiplayer_rounds.room_id) AND (r.host_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.multiplayer_rooms r
  WHERE ((r.id = multiplayer_rounds.room_id) AND (r.host_id = auth.uid())))));

CREATE POLICY "rounds: select authenticated" ON public.multiplayer_rounds
  FOR SELECT
  USING ((auth.uid() IS NOT NULL));

CREATE TABLE public.profiles (
  id           uuid                     NOT NULL,
  username     text,
  avatar_url   text,
  role         text                     DEFAULT 'user'::text NOT NULL,
  total_score  bigint                   DEFAULT 0 NOT NULL,
  games_played integer                  DEFAULT 0 NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  xp           bigint                   DEFAULT 0 NOT NULL,
  email        text
);

CREATE POLICY "analytics admin read" ON public.analytics_events
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "cfg: admin write" ON public.app_config
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "cat: admin write" ON public.campaign_categories
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "cat: read published" ON public.campaign_categories
  FOR SELECT
  USING (((status = 'published'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));

CREATE POLICY "campev: admin write" ON public.campaign_events
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "campev: read" ON public.campaign_events
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM public.campaigns c
  WHERE ((c.id = campaign_events.campaign_id) AND ((c.status = 'published'::text) OR (EXISTS ( SELECT 1
           FROM public.profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))))));

CREATE POLICY "rew: admin write" ON public.campaign_rewards
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "rew: read" ON public.campaign_rewards
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM public.campaigns c
  WHERE ((c.id = campaign_rewards.campaign_id) AND ((c.status = 'published'::text) OR (EXISTS ( SELECT 1
           FROM public.profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))))));

CREATE POLICY "camp: admin write" ON public.campaigns
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "camp: read published" ON public.campaigns
  FOR SELECT
  USING (((status = 'published'::text) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));

CREATE POLICY "daily_assignments admin write" ON public.daily_challenge_assignments
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "audit: admin select" ON public.entitlement_audit
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "sessions: admin select all" ON public.game_sessions
  FOR SELECT
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

ALTER TABLE public.profiles
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE public.analytics_events
  ADD CONSTRAINT analytics_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.daily_results
  ADD CONSTRAINT daily_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.events
  ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.friendships
  ADD CONSTRAINT friendships_addressee_id_fkey FOREIGN KEY (addressee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.friendships
  ADD CONSTRAINT friendships_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.game_sessions
  ADD CONSTRAINT game_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.multiplayer_answers
  ADD CONSTRAINT multiplayer_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.multiplayer_players
  ADD CONSTRAINT multiplayer_players_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.multiplayer_rooms
  ADD CONSTRAINT multiplayer_rooms_host_id_fkey FOREIGN KEY (host_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['user'::text, 'admin'::text]));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_key UNIQUE (username);

GRANT SELECT ON public.profiles TO authenticated;

GRANT UPDATE (avatar_url, username) ON public.profiles TO authenticated;

CREATE UNIQUE INDEX profiles_username_unique ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

CREATE POLICY "select own profile" ON public.profiles
  FOR SELECT
  USING ((auth.uid() = id));

CREATE POLICY "update own profile" ON public.profiles
  FOR UPDATE
  USING ((auth.uid() = id));

CREATE TABLE public.single_player_presets (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id    uuid                     NOT NULL,
  name       text                     NOT NULL,
  rules      jsonb                    DEFAULT '{}'::jsonb NOT NULL,
  is_shared  boolean                  DEFAULT false NOT NULL,
  share_slug text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.single_player_presets
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.single_player_presets
  ADD CONSTRAINT single_player_presets_name_check CHECK (length(TRIM(BOTH FROM name)) >= 1 AND length(TRIM(BOTH FROM name)) <= 60);

ALTER TABLE public.single_player_presets
  ADD CONSTRAINT single_player_presets_pkey PRIMARY KEY (id);

ALTER TABLE public.single_player_presets
  ADD CONSTRAINT single_player_presets_share_slug_key UNIQUE (share_slug);

ALTER TABLE public.single_player_presets
  ADD CONSTRAINT single_player_presets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

GRANT DELETE, INSERT, SELECT, UPDATE ON public.single_player_presets TO authenticated;

CREATE INDEX idx_sp_presets_user ON public.single_player_presets (user_id, updated_at DESC);

CREATE POLICY "sp: own all" ON public.single_player_presets
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE TABLE public.subscriptions (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  user_id      uuid                     NOT NULL,
  plan         text                     DEFAULT 'premium'::text NOT NULL,
  status       text                     DEFAULT 'active'::text NOT NULL,
  source       text                     DEFAULT 'manual'::text NOT NULL,
  started_at   timestamp with time zone DEFAULT now() NOT NULL,
  expires_at   timestamp with time zone,
  external_ref text,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.subscriptions
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_source_check CHECK (source = ANY (ARRAY['manual'::text, 'admin'::text, 'promo'::text, 'stripe'::text, 'apple'::text, 'google'::text]));

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check CHECK (status = ANY (ARRAY['active'::text, 'canceled'::text, 'expired'::text]));

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

GRANT SELECT ON public.subscriptions TO authenticated;

CREATE INDEX idx_subscriptions_user ON public.subscriptions (user_id);

CREATE POLICY "subs: select own" ON public.subscriptions
  FOR SELECT
  USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));

CREATE TABLE public.user_campaign_progress (
  user_id            uuid                     NOT NULL,
  campaign_id        uuid                     NOT NULL,
  best_score         integer                  DEFAULT 0 NOT NULL,
  best_stars         integer                  DEFAULT 0 NOT NULL,
  completed_runs     integer                  DEFAULT 0 NOT NULL,
  attempts_count     integer                  DEFAULT 0 NOT NULL,
  first_completed_at timestamp with time zone,
  last_played_at     timestamp with time zone
);

ALTER TABLE public.user_campaign_progress
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_campaign_progress
  ADD CONSTRAINT user_campaign_progress_best_stars_check CHECK (best_stars >= 0 AND best_stars <= 3);

ALTER TABLE public.user_campaign_progress
  ADD CONSTRAINT user_campaign_progress_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;

ALTER TABLE public.user_campaign_progress
  ADD CONSTRAINT user_campaign_progress_pkey PRIMARY KEY (user_id, campaign_id);

ALTER TABLE public.user_campaign_progress
  ADD CONSTRAINT user_campaign_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

GRANT SELECT ON public.user_campaign_progress TO authenticated;

CREATE POLICY "ucp: select own" ON public.user_campaign_progress
  FOR SELECT
  USING ((auth.uid() = user_id));

CREATE TABLE public.user_campaign_rewards (
  user_id    uuid                     NOT NULL,
  reward_id  uuid                     NOT NULL,
  granted_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.user_campaign_rewards
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_campaign_rewards
  ADD CONSTRAINT user_campaign_rewards_pkey PRIMARY KEY (user_id, reward_id);

ALTER TABLE public.user_campaign_rewards
  ADD CONSTRAINT user_campaign_rewards_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.campaign_rewards(id) ON DELETE CASCADE;

ALTER TABLE public.user_campaign_rewards
  ADD CONSTRAINT user_campaign_rewards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

GRANT SELECT ON public.user_campaign_rewards TO authenticated;

CREATE POLICY "urew: select own" ON public.user_campaign_rewards
  FOR SELECT
  USING ((auth.uid() = user_id));

CREATE TABLE public.user_category_hits (
  user_id  uuid    NOT NULL,
  category text    NOT NULL,
  hits     integer DEFAULT 0 NOT NULL
);

ALTER TABLE public.user_category_hits
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_category_hits
  ADD CONSTRAINT user_category_hits_pkey PRIMARY KEY (user_id, category);

ALTER TABLE public.user_category_hits
  ADD CONSTRAINT user_category_hits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

GRANT SELECT ON public.user_category_hits TO authenticated;

CREATE POLICY "uch: select own" ON public.user_category_hits
  FOR SELECT
  USING ((auth.uid() = user_id));

CREATE TABLE public.user_daily_campaign_usage (
  user_id     uuid                     NOT NULL,
  usage_date  date                     NOT NULL,
  used_count  integer                  DEFAULT 0 NOT NULL,
  bonus_count integer                  DEFAULT 0 NOT NULL,
  updated_at  timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.user_daily_campaign_usage
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_daily_campaign_usage
  ADD CONSTRAINT user_daily_campaign_usage_bonus_count_check CHECK (bonus_count >= 0);

ALTER TABLE public.user_daily_campaign_usage
  ADD CONSTRAINT user_daily_campaign_usage_pkey PRIMARY KEY (user_id, usage_date);

ALTER TABLE public.user_daily_campaign_usage
  ADD CONSTRAINT user_daily_campaign_usage_used_count_check CHECK (used_count >= 0);

ALTER TABLE public.user_daily_campaign_usage
  ADD CONSTRAINT user_daily_campaign_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

GRANT SELECT ON public.user_daily_campaign_usage TO authenticated;

CREATE POLICY "usage: select own" ON public.user_daily_campaign_usage
  FOR SELECT
  USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));

CREATE TABLE public.user_entitlements (
  user_id       uuid                     NOT NULL,
  is_premium    boolean                  DEFAULT false NOT NULL,
  premium_until timestamp with time zone,
  source        text,
  granted_by    uuid,
  reason        text,
  updated_at    timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.user_entitlements
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_entitlements
  ADD CONSTRAINT user_entitlements_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id);

ALTER TABLE public.user_entitlements
  ADD CONSTRAINT user_entitlements_pkey PRIMARY KEY (user_id);

ALTER TABLE public.user_entitlements
  ADD CONSTRAINT user_entitlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

GRANT SELECT ON public.user_entitlements TO authenticated;

CREATE POLICY "ent: select own" ON public.user_entitlements
  FOR SELECT
  USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));
