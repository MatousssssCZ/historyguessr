-- Motivace editorů: žebříček přínosu podle zpracovaných zadání.
-- Zdroj = event_tasks.assigned_to (editor, který zadání zpracoval). Počítáme:
--   approved  = schválené (published) události = reálný přínos
--   pending   = odeslané, čekají na schválení
--   submitted = vše odeslané ke schválení (approved + pending + rejected)
-- Vrácená zadání (status→todo, assigned_to=null) se nezapočítávají — správně.
--
-- SECURITY DEFINER, ať vidí zadání všech editorů (RLS jinak pustí jen todo/vlastní).
-- Přístup jen pro staff (editor|admin). Idempotentní.
create or replace function public.editor_leaderboard()
returns table (user_id uuid, username text, approved int, pending int, submitted int)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_editor() then raise exception 'forbidden'; end if;
  return query
  select t.assigned_to,
         p.username,
         count(*) filter (where t.status = 'approved')::int,
         count(*) filter (where t.status = 'submitted')::int,
         count(*) filter (where t.status in ('approved','submitted','rejected'))::int
  from public.event_tasks t
  join public.profiles p on p.id = t.assigned_to
  where t.assigned_to is not null
  group by t.assigned_to, p.username
  having count(*) filter (where t.status in ('approved','submitted','rejected')) > 0
  order by count(*) filter (where t.status = 'approved') desc,
           count(*) filter (where t.status in ('approved','submitted','rejected')) desc,
           p.username asc;
end $$;

grant execute on function public.editor_leaderboard() to authenticated;
