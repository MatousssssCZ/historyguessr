-- HistoryGuessr · Migrace 010 · Číselné ID událostí (od 1 vzestupně)
-- Doplní ke každé události čitelné pořadové číslo. Stávající se očíslují
-- podle data vytvoření; nové dostanou další číslo automaticky.
--
-- Spusť v Supabase SQL editoru.

alter table public.events add column if not exists seq int;

-- Backfill: vzestupně podle vzniku
with ordered as (
  select id, row_number() over (order by created_at, id) as rn
  from public.events
)
update public.events e
   set seq = o.rn
  from ordered o
 where e.id = o.id and e.seq is null;

-- Sekvence pro nové události
create sequence if not exists public.events_seq_seq;
select setval('public.events_seq_seq', coalesce((select max(seq) from public.events), 0));
alter table public.events alter column seq set default nextval('public.events_seq_seq');
alter sequence public.events_seq_seq owned by public.events.seq;

-- Povinné + unikátní
alter table public.events alter column seq set not null;
create unique index if not exists events_seq_key on public.events (seq);
