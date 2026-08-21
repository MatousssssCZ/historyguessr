-- Explore F3: publikované kampaně čitelné i bez přihlášení (pro veřejné SSG stránky).
--
-- Problém: stávající read-politiky mají inline `EXISTS(SELECT FROM profiles ...)`.
-- anon nemá SELECT na profiles → i u publikovaných řádků padá „permission denied for
-- table profiles". Funkce public.is_admin() je SECURITY DEFINER (čte profiles jako
-- vlastník), takže ji anon může volat bez chyby. Přepíšeme read-politiky na is_admin().
-- Sémantika beze změny: publikované vidí všichni, admin vidí vše. Idempotentní.

-- campaign_categories
drop policy if exists "cat: read published" on public.campaign_categories;
create policy "cat: read published" on public.campaign_categories
  for select
  using (status = 'published' or public.is_admin());

-- campaigns
drop policy if exists "camp: read published" on public.campaigns;
create policy "camp: read published" on public.campaigns
  for select
  using (status = 'published' or public.is_admin());

-- campaign_events (kolo je čitelné, pokud je jeho kampaň publikovaná; admin vše)
drop policy if exists "campev: read" on public.campaign_events;
create policy "campev: read" on public.campaign_events
  for select
  using (exists (
    select 1 from public.campaigns c
    where c.id = campaign_events.campaign_id
      and (c.status = 'published' or public.is_admin())
  ));

-- campaign_rewards (stejný vzor — kvůli konzistenci, i když je F3 nepotřebuje)
drop policy if exists "rew: read" on public.campaign_rewards;
create policy "rew: read" on public.campaign_rewards
  for select
  using (exists (
    select 1 from public.campaigns c
    where c.id = campaign_rewards.campaign_id
      and (c.status = 'published' or public.is_admin())
  ));
