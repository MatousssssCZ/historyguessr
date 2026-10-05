-- Notifikační centrum + podklady pro večerní připomínku denní výzvy.

-- 1) Moje notifikace: kdo mi poslal posla + jaké měl ten den v denní výzvě skóre.
create or replace function public.my_notifications()
returns table(sender_id uuid, username text, day date, sender_score int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select mn.sender_id, p.username, mn.day, dr.score, mn.created_at
  from public.messenger_nudges mn
  join public.profiles p on p.id = mn.sender_id
  left join public.daily_results dr on dr.user_id = mn.sender_id and dr.date = mn.day
  where mn.target_id = auth.uid()
  order by mn.created_at desc
  limit 50;
$$;
grant execute on function public.my_notifications() to authenticated;

-- 2) Log odeslaných večerních připomínek (idempotence — 1× za den na hráče).
create table if not exists public.daily_reminder_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null default (now() at time zone 'Europe/Prague')::date,
  sent_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.daily_reminder_log enable row level security;
-- Čte/píše jen server (service role, obchází RLS) — běžní uživatelé sem nemají přístup.

-- 3) Komu dnes poslat večerní připomínku: má push odběr, NEodehrál dnešní denní
--    výzvu, NEdostal dnes posla a ještě mu dnes připomínka nešla.
--    Volá jen cron přes service role (vrací cizí odběry → NEGRANTovat authenticated).
create or replace function public.users_needing_daily_reminder()
returns table(user_id uuid, endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = public as $$
  with today as (select (now() at time zone 'Europe/Prague')::date as d)
  select ps.user_id, ps.endpoint, ps.p256dh, ps.auth
  from public.push_subscriptions ps, today
  where not exists (select 1 from public.daily_results dr where dr.user_id = ps.user_id and dr.date = today.d)
    and not exists (select 1 from public.messenger_nudges mn where mn.target_id = ps.user_id and mn.day = today.d)
    and not exists (select 1 from public.daily_reminder_log l where l.user_id = ps.user_id and l.day = today.d);
$$;
revoke all on function public.users_needing_daily_reminder() from authenticated, anon;
