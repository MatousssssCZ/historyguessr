-- E-mail v profiles chyběl u účtů vzniklých konverzí hosta: e-mail se do
-- auth.users zapisuje UPDATE (updateUser), ale sync trigger reagoval jen na
-- změnu is_anonymous. Když se e-mail nastavil v UPDATE bez změny is_anonymous,
-- do profiles se nepropsal. Idempotentní.

-- 1) Backfill: doplň chybějící e-maily z auth.users
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is null
   and u.email is not null;

-- 2) Rozšiř sync trigger, ať reaguje i na změnu e-mailu (nejen is_anonymous).
--    Funkce public.sync_profile_anon už email i is_anonymous synchronizuje.
drop trigger if exists on_auth_user_anon_sync on auth.users;
create trigger on_auth_user_anon_sync
  after update of is_anonymous, email on auth.users
  for each row execute function public.sync_profile_anon();
