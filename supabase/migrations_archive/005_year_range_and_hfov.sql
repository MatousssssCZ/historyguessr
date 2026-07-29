-- Migrace 005 — year_from/year_to místo year+year_range, hfov pro panoramu

alter table public.events
  add column if not exists year_from int,
  add column if not exists year_to   int,
  add column if not exists hfov      int not null default 100;

-- Naplň z existujících dat
update public.events set
  year_from = year - year_range,
  year_to   = year + year_range
where year_from is null;

alter table public.events
  alter column year_from set not null,
  alter column year_to   set not null;
