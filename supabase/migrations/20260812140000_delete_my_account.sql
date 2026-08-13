-- Smazání vlastního účtu (GDPR). Uživatel smaže SÁM SEBE — SECURITY DEFINER
-- funkce smaže řádek v auth.users, což kaskádově smaže profil i všechna data.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  delete from auth.users where id = uid;
end;
$$;

comment on function public.delete_my_account() is
  'Úplně a trvale smaže účet volajícího uživatele (kaskáda z auth.users).';

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
