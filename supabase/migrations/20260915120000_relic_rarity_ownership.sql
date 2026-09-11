-- Podíl vlastníků dané RARITY relikvie (pro Kroniku: „X % vlastní tuto raritu").
-- Doplňuje relic_ownership (celkové vlastnictví) o rozpad podle state. Idempotentní.
create or replace view public.relic_rarity_ownership as
select
  pr.relic_id,
  pr.state,
  count(distinct pr.user_id) as owners,
  round(
    count(distinct pr.user_id)::numeric
    / nullif((select count(*) from public.profiles), 0) * 100
  , 1) as pct
from public.player_relics pr
group by pr.relic_id, pr.state;

grant select on public.relic_rarity_ownership to anon, authenticated;
