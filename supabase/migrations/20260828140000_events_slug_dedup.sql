-- Oprava: trigger events_fill_slug generoval slug ze slugify(title) BEZ deduplikace,
-- takže druhá událost se stejným (nebo podobně slugovaným) názvem spadla na unikátní
-- index events_slug_key → "duplicate key value violates unique constraint" (23505).
--
-- Nově: pro každý slug sloupec najdeme volnou variantu — když base koliduje, přidáme
-- „-2", „-3", … (stejné chování jako původní backfill s row_number). Stále BEFORE INSERT
-- (slugy zůstávají stabilní; přejmenování je nemění). Idempotentní.

-- Vrátí volný slug pro daný sloupec: base, nebo base-2 / base-3 / … když už existuje.
-- SECURITY DEFINER: kontrola unikátnosti musí vidět VŠECHNY události (i publikované),
-- jinak by editor přes RLS viděl jen drafty a kolizi s publikovaným slugem by minul.
create or replace function public.events_unique_slug(p_base text, p_col text, p_self uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  cand  text := p_base;
  i     int  := 1;
  clash boolean;
begin
  loop
    execute format(
      'select exists(select 1 from public.events where %I = $1 and ($2 is null or id <> $2))', p_col
    ) into clash using cand, p_self;
    exit when not clash;
    i := i + 1;
    cand := left(p_base, 76) || '-' || i;   -- drž pod 80 znaků
  end loop;
  return cand;
end $$;

create or replace function public.events_fill_slug()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare base text;
begin
  if new.slug is null then
    base := left(coalesce(nullif(public.slugify(new.title), ''), 'udalost'), 80);
    new.slug := public.events_unique_slug(base, 'slug', new.id);
  end if;
  if new.slug_en is null then
    base := left(coalesce(nullif(public.slugify(coalesce(new.title_en, new.title)), ''), new.slug), 80);
    new.slug_en := public.events_unique_slug(base, 'slug_en', new.id);
  end if;
  if new.slug_de is null then
    base := left(coalesce(nullif(public.slugify(coalesce(new.title_de, new.title)), ''), new.slug), 80);
    new.slug_de := public.events_unique_slug(base, 'slug_de', new.id);
  end if;
  return new;
end $$;

-- Editor (invoker events_fill_slug) potřebuje EXECUTE na definer helper.
grant execute on function public.events_unique_slug(text, text, uuid) to authenticated;

-- Trigger zůstává (BEFORE INSERT); jen se používá opravená funkce.
drop trigger if exists trg_events_fill_slug on public.events;
create trigger trg_events_fill_slug
  before insert on public.events
  for each row execute function public.events_fill_slug();
