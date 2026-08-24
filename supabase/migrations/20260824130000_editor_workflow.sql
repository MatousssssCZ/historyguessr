-- Editorský workflow: role „editor" + číselník zadání událostí.
-- Admin přidává zadání (název+rok) → editoři je zpracují (AI + panorama) →
-- odešlou „ke schválení" → admin zkontroluje/upraví a publikuje / vrátí / zruší.
-- Idempotentní.

-- ── Helper: is_editor (editor NEBO admin = „staff") ─────────────────────────
create or replace function public.is_editor()
  returns boolean language sql stable security definer set search_path to 'public'
  as $$ select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('editor','admin')
  ); $$;

-- ── Číselník zadání ─────────────────────────────────────────────────────────
create table if not exists public.event_tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  year         integer,
  category     text,
  note         text,                       -- poznámka admina k zadání
  status       text not null default 'todo'
                 check (status in ('todo','in_progress','submitted','approved','rejected')),
  assigned_to  uuid references auth.users(id) on delete set null,   -- editor, který si vzal
  event_id     uuid references public.events(id) on delete set null, -- vzniklý draft
  review_note  text,                       -- zpětná vazba admina při vrácení
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists event_tasks_status_idx on public.event_tasks (status, updated_at desc);
alter table public.event_tasks enable row level security;

create or replace function public.touch_event_task()
  returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_touch_event_task on public.event_tasks;
create trigger trg_touch_event_task before update on public.event_tasks
  for each row execute function public.touch_event_task();

-- ── RLS: event_tasks ────────────────────────────────────────────────────────
-- admin: plný přístup; editor: čte „todo" + vlastní (zápis jen přes RPC níže).
drop policy if exists "tasks: admin all" on public.event_tasks;
create policy "tasks: admin all" on public.event_tasks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "tasks: editor read" on public.event_tasks;
create policy "tasks: editor read" on public.event_tasks for select to authenticated
  using (public.is_editor() and (status = 'todo' or assigned_to = auth.uid()));

-- ── RLS: events pro editory ────────────────────────────────────────────────
-- Editor smí zakládat/upravovat/číst jen NEpublikované koncepty; publikovat NE.
drop policy if exists "events: editor insert draft" on public.events;
create policy "events: editor insert draft" on public.events for insert to authenticated
  with check (public.is_editor() and published = false);

drop policy if exists "events: editor update draft" on public.events;
create policy "events: editor update draft" on public.events for update to authenticated
  using (public.is_editor() and published = false)
  with check (public.is_editor() and published = false);

drop policy if exists "events: editor select draft" on public.events;
create policy "events: editor select draft" on public.events for select to authenticated
  using (public.is_editor() and published = false);

-- ── RPC: editor si zabere zadání ────────────────────────────────────────────
create or replace function public.claim_event_task(p_task uuid)
  returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_editor() then raise exception 'forbidden'; end if;
  update public.event_tasks
     set status = 'in_progress', assigned_to = auth.uid()
   where id = p_task and status in ('todo','in_progress')
     and (assigned_to is null or assigned_to = auth.uid());
  if not found then raise exception 'task_taken'; end if;
end $$;
grant execute on function public.claim_event_task(uuid) to authenticated;

-- ── RPC: editor naváže vzniklý draft na zadání (uložení rozpracovaného) ─────
create or replace function public.attach_event_task(p_task uuid, p_event uuid)
  returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_editor() then raise exception 'forbidden'; end if;
  update public.event_tasks set event_id = p_event
   where id = p_task and assigned_to = auth.uid() and status = 'in_progress';
  if not found then raise exception 'not_your_task'; end if;
end $$;
grant execute on function public.attach_event_task(uuid, uuid) to authenticated;

-- ── RPC: editor odešle ke schválení ─────────────────────────────────────────
create or replace function public.submit_event_task(p_task uuid, p_event uuid)
  returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_editor() then raise exception 'forbidden'; end if;
  update public.event_tasks
     set status = 'submitted', event_id = p_event, review_note = null
   where id = p_task and assigned_to = auth.uid() and status = 'in_progress';
  if not found then raise exception 'not_your_task'; end if;
end $$;
grant execute on function public.submit_event_task(uuid, uuid) to authenticated;

-- ── RPC: admin vrátí zadání do číselníku (zachová draft) ─────────────────────
create or replace function public.return_event_task(p_task uuid, p_note text)
  returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.event_tasks
     set status = 'todo', assigned_to = null, review_note = nullif(trim(coalesce(p_note,'')), '')
   where id = p_task;
end $$;
grant execute on function public.return_event_task(uuid, text) to authenticated;

-- ── RPC: admin přiřadí roli (podle username) ────────────────────────────────
create or replace function public.set_user_role(p_username text, p_role text)
  returns text language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_role not in ('user','editor','admin') then raise exception 'bad_role'; end if;
  select id into v_id from public.profiles where lower(username) = lower(trim(p_username)) limit 1;
  if v_id is null then return 'not_found'; end if;
  update public.profiles set role = p_role where id = v_id;
  return 'ok';
end $$;
grant execute on function public.set_user_role(text, text) to authenticated;
