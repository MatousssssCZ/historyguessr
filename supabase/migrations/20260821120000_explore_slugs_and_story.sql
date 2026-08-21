-- Explore vrstva (veřejné SEO stránky): stabilní slugy událostí + úložiště
-- delšího čtenářského textu. Idempotentní.

-- unaccent kvůli diakritice v SQL slugify (běžně dostupné v Supabase).
create extension if not exists unaccent;

-- SQL varianta slugify() pro backfill. (Runtime appka/generátor používá
-- src/lib/slugify.ts — držet výsledky srovnatelné.)
create or replace function public.slugify(txt text)
returns text
language sql immutable strict
as $$
  select
    trim(both '-' from
      regexp_replace(
        regexp_replace(
          lower(unaccent(coalesce(txt, ''))),
          '[^a-z0-9]+', '-', 'g'          -- vše mimo [a-z0-9] → pomlčka
        ),
        '-{2,}', '-', 'g'                  -- vícenásobné pomlčky → jedna
      )
    )
$$;

-- Sloupce slugů (per jazyk) + úložiště příběhu.
alter table public.events add column if not exists slug     text;
alter table public.events add column if not exists slug_en  text;
alter table public.events add column if not exists slug_de  text;
alter table public.events add column if not exists story_cs jsonb;  -- {"titulek": text, "odstavce": [text,...]}
alter table public.events add column if not exists story_en jsonb;
alter table public.events add column if not exists story_de jsonb;

-- Backfill jednoho slug sloupce z názvu s deduplikací (row_number).
-- Voláno pro cs/en/de zvlášť; vyplní jen řádky, kde je slug ještě null.
do $$
declare
  rec record;
begin
  -- base slug (cs)
  with base as (
    select id,
           left(coalesce(nullif(public.slugify(title), ''), 'udalost'), 80) as s
    from public.events
    where slug is null
  ), numbered as (
    select id, s,
           row_number() over (partition by s order by id) as rn
    from base
  )
  update public.events e
  set slug = case when n.rn = 1 then n.s else n.s || '-' || n.rn end
  from numbered n
  where e.id = n.id;

  -- slug_en (fallback na title, pak na base slug)
  with base as (
    select id,
           left(coalesce(nullif(public.slugify(coalesce(title_en, title)), ''), slug), 80) as s
    from public.events
    where slug_en is null
  ), numbered as (
    select id, s, row_number() over (partition by s order by id) as rn
    from base
  )
  update public.events e
  set slug_en = case when n.rn = 1 then n.s else n.s || '-' || n.rn end
  from numbered n
  where e.id = n.id;

  -- slug_de (fallback na title, pak na base slug)
  with base as (
    select id,
           left(coalesce(nullif(public.slugify(coalesce(title_de, title)), ''), slug), 80) as s
    from public.events
    where slug_de is null
  ), numbered as (
    select id, s, row_number() over (partition by s order by id) as rn
    from base
  )
  update public.events e
  set slug_de = case when n.rn = 1 then n.s else n.s || '-' || n.rn end
  from numbered n
  where e.id = n.id;
end $$;

-- Unikátnost slugů (jen mezi vyplněnými; null se neopakuje v unikátním indexu).
create unique index if not exists events_slug_key    on public.events (slug)    where slug    is not null;
create unique index if not exists events_slug_en_key on public.events (slug_en) where slug_en is not null;
create unique index if not exists events_slug_de_key on public.events (slug_de) where slug_de is not null;

-- Nové publikované události dostanou slug automaticky (kdyby ho admin nevyplnil).
create or replace function public.events_fill_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null then
    new.slug := left(coalesce(nullif(public.slugify(new.title), ''), 'udalost'), 80);
  end if;
  if new.slug_en is null then
    new.slug_en := left(coalesce(nullif(public.slugify(coalesce(new.title_en, new.title)), ''), new.slug), 80);
  end if;
  if new.slug_de is null then
    new.slug_de := left(coalesce(nullif(public.slugify(coalesce(new.title_de, new.title)), ''), new.slug), 80);
  end if;
  return new;
end $$;

drop trigger if exists trg_events_fill_slug on public.events;
create trigger trg_events_fill_slug
  before insert on public.events
  for each row execute function public.events_fill_slug();
