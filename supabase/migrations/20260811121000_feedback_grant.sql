-- ─────────────────────────────────────────────────────────────
-- Oprava: admin neviděl žádnou zpětnou vazbu.
--
-- Tabulka feedback měla RLS „jen admin (is_admin())", ale CHYBĚL table-GRANT
-- SELECT/UPDATE pro roli authenticated → i admin dostal „permission denied
-- for table feedback". RLS bez GRANTu nestačí.
--
-- Přidáním GRANTu se k tabulce dostane role authenticated, ale RLS pořád
-- pouští jen admina (ostatní authenticated vidí prázdno). Bezpečné.
-- Idempotentní.
-- ─────────────────────────────────────────────────────────────

grant select, update on public.feedback to authenticated;
