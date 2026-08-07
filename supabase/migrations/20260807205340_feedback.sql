-- HistoryGuessr · Hlášení chyb / zpětná vazba
--
-- Uživatel (i anonymní) může poslat bug/nápad/jiné. Vkládá se přes
-- SECURITY DEFINER RPC (nejde spoofnout user_id ani obejít). Čte/spravuje
-- jen admin. Idempotentní. Testuj lokálně `supabase db reset`.

create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null default 'bug' check (kind in ('bug','idea','other')),
  message    text not null,
  page       text,
  user_agent text,
  user_id    uuid references auth.users(id) on delete set null,
  status     text not null default 'new' check (status in ('new','in_progress','done')),
  created_at timestamptz not null default now()
);
create index if not exists idx_feedback_status_created on public.feedback(status, created_at desc);

alter table public.feedback enable row level security;

-- Číst a spravovat smí jen admin.
drop policy if exists feedback_admin on public.feedback;
create policy feedback_admin on public.feedback for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Vkládání přes RPC — SECURITY DEFINER obchází RLS a doplní user_id ze session.
create or replace function public.submit_feedback(p_kind text, p_message text, p_page text, p_ua text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  k text := lower(coalesce(p_kind, 'bug'));
begin
  if k not in ('bug','idea','other') then k := 'other'; end if;
  if coalesce(btrim(p_message), '') = '' then raise exception 'empty_message'; end if;
  insert into public.feedback(kind, message, page, user_agent, user_id)
    values (k, left(btrim(p_message), 2000), left(p_page, 300), left(p_ua, 300), auth.uid())
    returning id into new_id;
  return new_id;
end $$;
grant execute on function public.submit_feedback(text, text, text, text) to anon, authenticated;
