-- HistoryGuessr · Migrace 029 · GRANTy pro tabulky kampaní
--
-- Migrace 028 nastavila RLS politiky, ale tabulky vytvořené přes SQL editor
-- nemají automatické table-level GRANTy pro role anon/authenticated → klient
-- dostával „permission denied for table campaign_categories".
--
-- RLS dál hlídá řádkový přístup (admin-write, public-read published);
-- tyto GRANTy jen povolují operace na úrovni tabulky.
--
-- Spusť v Supabase SQL editoru. Idempotentní.

grant select, insert, update, delete
  on public.campaign_categories,
     public.campaigns,
     public.campaign_events,
     public.user_campaign_progress
  to authenticated;

-- Čtení publikovaných kampaní i pro nepřihlášené (RLS stejně omezí na published);
-- neškodí, kdyby se kampaně někdy zobrazovaly bez přihlášení.
grant select
  on public.campaign_categories,
     public.campaigns,
     public.campaign_events
  to anon;
