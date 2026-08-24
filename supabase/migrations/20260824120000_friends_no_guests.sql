-- Hosté (hra bez registrace, auth.users.is_anonymous = true) nesmí být součástí
-- systému přátel: nelze je přidat mezi přátele a sami nemohou žádosti posílat.
-- Rozšiřuje send_friend_request o kontrolu anonymity na obou stranách.
-- Idempotentní (create or replace).

create or replace function public.send_friend_request(p_username text)
  returns text language plpgsql security definer set search_path to 'public' as $function$
declare
  v_me uuid := auth.uid();
  v_target uuid;
  v_me_anon boolean;
  v_target_anon boolean;
  v_existing record;
begin
  if v_me is null then return 'unauthorized'; end if;

  -- Host (anonymní) nemůže přidávat přátele
  select coalesce(is_anonymous, false) into v_me_anon from public.profiles where id = v_me;
  if coalesce(v_me_anon, false) then return 'guest_self'; end if;

  select id, coalesce(is_anonymous, false)
    into v_target, v_target_anon
    from public.profiles
   where lower(username) = lower(trim(p_username)) limit 1;

  if v_target is null then return 'not_found'; end if;
  if v_target = v_me then return 'self'; end if;
  -- Nelze přidat hosta (hráče bez registrace)
  if coalesce(v_target_anon, false) then return 'guest_target'; end if;

  select * into v_existing from public.friendships
   where (requester_id = v_me and addressee_id = v_target)
      or (requester_id = v_target and addressee_id = v_me)
   limit 1;

  if found then
    if v_existing.status = 'accepted' then
      return 'already_friends';
    end if;
    if v_existing.requester_id = v_target then
      update public.friendships set status = 'accepted'
       where requester_id = v_target and addressee_id = v_me;
      return 'accepted';
    end if;
    return 'pending';
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (v_me, v_target, 'pending');
  return 'sent';
end;
$function$;

grant execute on function public.send_friend_request(text) to authenticated;
