-- HistoryGuessr · Migrace 034 · Validace publikace kampaně (server vynucuje)
--
-- Zadání (bod 18): kampaň nepůjde publikovat, pokud
--   • nemá odpovídající počet AKTIVNÍCH událostí (dle rounds_count)
--   • některá událost není publikovaná
--   • některá událost nemá panorama
--   • chybí validní GPS souřadnice
--   • chybí rok / časový rozsah
--   • stejná událost je vložena vícekrát  (řeší unique z migrace 031)
--
-- Neřešíme to jen v UI — trigger to vynutí i kdyby zápis přišel odjinud.
-- Stejnou funkci čte admin, aby chyby ukázal ještě před uložením.
--
-- Spusť v Supabase SQL editoru. Idempotentní. Vyžaduje migraci 031.

/** Vrátí seznam důvodů, proč kampaň NELZE publikovat. Prázdné pole = v pořádku. */
create or replace function public.campaign_publish_errors(p_campaign_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
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
$$;
grant execute on function public.campaign_publish_errors(uuid) to authenticated;

/** Trigger: publikovat lze jen bezvadnou kampaň. */
create or replace function public.enforce_campaign_publishable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

drop trigger if exists trg_campaign_publishable on public.campaigns;
create trigger trg_campaign_publishable
  before insert or update on public.campaigns
  for each row execute function public.enforce_campaign_publishable();

/**
 * Změna obsahu už publikované kampaně ji nesmí rozbít.
 * Když admin odebere/deaktivuje událost tak, že kampaň přestane být validní,
 * shodíme ji do konceptu (raději skrytá než rozbitá pro hráče).
 */
create or replace function public.demote_broken_campaign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign uuid := coalesce(new.campaign_id, old.campaign_id);
begin
  if exists (select 1 from public.campaigns where id = v_campaign and status = 'published')
     and array_length(public.campaign_publish_errors(v_campaign), 1) > 0 then
    update public.campaigns set status = 'draft', updated_at = now() where id = v_campaign;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_campaign_events_demote on public.campaign_events;
create trigger trg_campaign_events_demote
  after insert or update or delete on public.campaign_events
  for each row execute function public.demote_broken_campaign();

/** Duplikace kampaně jako KONCEPT (včetně událostí). Jen admin. */
create or replace function public.admin_duplicate_campaign(p_campaign_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
$$;
grant execute on function public.admin_duplicate_campaign(uuid) to authenticated;
