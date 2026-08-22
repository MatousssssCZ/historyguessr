-- Explore F3 (dokončení): anon stále dostával „permission denied for table profiles"
-- při čtení kampaní. Příčina: admin-write politiky nemají FOR → platí i pro SELECT,
-- a jejich USING (EXISTS profiles) se u anon vyhodnocuje → chyba na profiles.
--
-- Řešení: přepsat admin-write politiky na public.is_admin() (SECURITY DEFINER, čte
-- profiles jako vlastník) a omezit je na roli `authenticated`, takže se u anon SELECT
-- vůbec nevyhodnocují. Čtení publikovaných řádků řeší „read" politiky z migrace
-- 20260821140000. Idempotentní.

drop policy if exists "cat: admin write" on public.campaign_categories;
create policy "cat: admin write" on public.campaign_categories
  as permissive for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "camp: admin write" on public.campaigns;
create policy "camp: admin write" on public.campaigns
  as permissive for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "campev: admin write" on public.campaign_events;
create policy "campev: admin write" on public.campaign_events
  as permissive for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "rew: admin write" on public.campaign_rewards;
create policy "rew: admin write" on public.campaign_rewards
  as permissive for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
