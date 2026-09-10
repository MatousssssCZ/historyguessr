-- Oprava: relikvie šly jen číst. RLS politiky pro admin zápis existovaly, ale
-- chyběl tabulkový GRANT INSERT/UPDATE/DELETE → i admin dostal
-- „permission denied for table relics". RLS (relics_admin_write / relic_sets_admin_write
-- s is_admin()) i po tomto grantu pouští zápis JEN adminovi. Idempotentní.

grant insert, update, delete on public.relics     to authenticated;
grant insert, update, delete on public.relic_sets to authenticated;
