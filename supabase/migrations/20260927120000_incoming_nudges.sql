-- Kdo mi dnes poslal „posla" na denní výzvu — pro in-app upozornění příjemce
-- (hlavně pro ty, kdo nemají zapnuté push notifikace). RLS-safe přes SECURITY DEFINER.
create or replace function public.incoming_nudges_today()
returns table(sender_id uuid, username text)
language sql stable security definer set search_path = public as $$
  select mn.sender_id, p.username
  from public.messenger_nudges mn
  join public.profiles p on p.id = mn.sender_id
  where mn.target_id = auth.uid()
    and mn.day = (now() at time zone 'utc')::date;
$$;
grant execute on function public.incoming_nudges_today() to authenticated;
