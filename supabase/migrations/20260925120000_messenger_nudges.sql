-- „Poslové" denní výzvy — hráč pošle příteli, který dnes ještě nehrál, push notifikaci.
-- Rate-limit: 1× denně na daného příjemce (UNIQUE sender+target+day).
create table if not exists public.messenger_nudges (
  id         uuid primary key default gen_random_uuid(),
  sender_id  uuid not null references auth.users(id) on delete cascade,
  target_id  uuid not null references auth.users(id) on delete cascade,
  day        date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  unique (sender_id, target_id, day)
);
create index if not exists messenger_nudges_sender_day_idx on public.messenger_nudges(sender_id, day);

alter table public.messenger_nudges enable row level security;
grant select, insert on public.messenger_nudges to authenticated;

-- Odesílatel vidí a zakládá jen své vlastní posly. (Server/Edge Function přes
-- service role RLS obchází — skutečné odeslání push a kontrola limitu běží tam.)
drop policy if exists msgnudge_select on public.messenger_nudges;
drop policy if exists msgnudge_insert on public.messenger_nudges;
create policy msgnudge_select on public.messenger_nudges for select using (auth.uid() = sender_id);
create policy msgnudge_insert on public.messenger_nudges for insert with check (auth.uid() = sender_id);

-- Komu jsem dnes už poslal posla (pro UI stav „Posel vyslán").
create or replace function public.messengers_sent_today()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select target_id from public.messenger_nudges
  where sender_id = auth.uid() and day = (now() at time zone 'utc')::date;
$$;
grant execute on function public.messengers_sent_today() to authenticated;
