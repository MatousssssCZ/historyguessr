-- HistoryGuessr · Migrace 023 · Workflow stav událostí + uložený panorama prompt
--
-- Pro hromadné AI zadávání a fronty:
--   status: 'draft' → 'awaiting_panorama' → 'awaiting_review' → 'published'
--   panorama_prompt: připravený prompt pro generování panoramatu (pro agenta)
--
-- `published` (bool) zůstává zdrojem pravdy pro viditelnost hráčům.
-- status = 'published' jde ruku v ruce s published = true.
--
-- Spusť v Supabase SQL editoru. Idempotentní.

alter table public.events add column if not exists status text not null default 'draft';
alter table public.events add column if not exists panorama_prompt text;

-- Backfill: existující publikované → 'published', s panoramatem ale nepublikované
-- → 'awaiting_review', ostatní → 'draft'.
update public.events
  set status = case
    when published then 'published'
    when panorama_url is not null and panorama_url <> '' and panorama_url <> 'pending' then 'awaiting_review'
    else 'draft'
  end
  where status is null or status = 'draft';

-- Volitelná kontrola povolených hodnot (nezablokuje existující data).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_status_chk') then
    alter table public.events add constraint events_status_chk
      check (status in ('draft','awaiting_panorama','awaiting_review','published'));
  end if;
end $$;

create index if not exists events_status_idx on public.events(status);
