-- ─────────────────────────────────────────────────────────────
-- Ověření produkční DB — zkontroluje, že všechny objekty z migrací
-- (0807–0809) na produkci existují. Spusť v Supabase SQL editoru.
-- Každý řádek: ✅ OK / ❌ CHYBÍ. Cokoli ❌ → chybí migrace.
-- ─────────────────────────────────────────────────────────────
with checks(kind, name, present) as (

  -- Sloupec profiles.is_anonymous (migrace anonymous_users)
  select 'column', 'profiles.is_anonymous', exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='is_anonymous')

  -- Funkce (pg_proc)
  union all select 'function', p.name, exists (
    select 1 from pg_proc pr join pg_namespace n on n.oid=pr.pronamespace
    where n.nspname='public' and pr.proname=p.name)
  from (values
    ('cleanup_stale_guests'), ('advance_battle_royale'), ('enforce_mp_join'),
    ('enforce_username'), ('sync_profile_anon'), ('daily_makeup_status'),
    ('submit_daily_makeup'), ('submit_feedback'), ('roadmap_list'),
    ('roadmap_suggest'), ('roadmap_toggle_vote'), ('get_world_rank'),
    ('username_norm'), ('handle_new_user')
  ) as p(name)

  -- Triggery (pg_trigger)
  union all select 'trigger', t.name, exists (
    select 1 from pg_trigger tg where tg.tgname=t.name and not tg.tgisinternal)
  from (values
    ('trg_enforce_username'), ('trg_enforce_mp_join'), ('on_auth_user_anon_sync')
  ) as t(name)

  -- Tabulky
  union all select 'table', tb.name, exists (
    select 1 from pg_tables where schemaname='public' and tablename=tb.name)
  from (values
    ('roadmap_items'), ('roadmap_votes'), ('feedback')
  ) as tb(name)
)
select
  case when present then '✅ OK' else '❌ CHYBÍ' end as stav,
  kind as typ,
  name as objekt
from checks
order by present asc, kind, name;
