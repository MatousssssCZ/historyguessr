-- HistoryGuessr · Doladění seznamu vulgarit + oprava falešných shod
--
-- Změny oproti username_rules:
--   • username_norm nově DE-ACCENTUJE (translate), aby server hlídal stejně
--     jako klient (ten diakritiku strhává) — seznamy jsou ASCII.
--   • dvě úrovně: STRONG (podřetězec) vs EXACT (jen celé jméno) → „nazi"
--     už neblokne „Ignazio", „rape" neblokne „Draper", „cigan" „Cigánek".
--   • doplněna běžná CZ/EN/DE slova.
--
-- create or replace → bezpečné pustit i po username_rules. Idempotentní.

create or replace function public.username_norm(u text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(
    translate(
      translate(
        lower(coalesce(u, '')),
        'áàâäãāčćçďéèêěëēíìîïīľĺłňńóòôöõōřŕšśťúùûůüūýÿžźż',
        'aaaaaacccdeeeeeeiiiiilllnnoooooorrsstuuuuuuyyzzz'),
      '013457@$', 'oieastas'),
    '[^a-z0-9]', '', 'g'
  );
$$;

create or replace function public.enforce_username()
returns trigger language plpgsql set search_path = public as $$
declare
  v text := btrim(regexp_replace(coalesce(new.username, ''), '\s+', ' ', 'g'));
  n text;
  w text;
  reserved text[] := array[
    'admin','administrator','administrace','moderator','mod','support','podpora',
    'system','root','staff','team','tym','official','historyguesser','historyguessr',
    'geoguessr','owner','operator','anonymous','anonym','guest','host','bot','null','undefined'
  ];
  -- Jednoznačné — blokují se jako PODŘETĚZEC.
  strong text[] := array[
    'kurva','kurwa','pica','curak','debil','kokot','kunda','mrdka','mrdat','jebat',
    'vyjeb','projeb','hovno','sracka','zmrd','zkurv','buzna','buzerant','chcanky','hajzl',
    'fuck','motherfuck','shit','bitch','cunt','asshole','nigger','nigga','faggot','whore',
    'pussy','wanker','retard','scheisse','arschloch','fotze','wichser','hurensohn',
    'schlampe','nutte','schwuchtel','hitler','hakenkreuz'
  ];
  -- Kolizní / krátká — blokují se jen když jimi je CELÉ jméno.
  weak text[] := array['prdel','prcat','rape','slut','dick','nazi','heil','kkk','cigan','cikan','cygan'];
begin
  if new.username is null then return new; end if;

  new.username := v;
  if char_length(v) < 3  then raise exception 'username_too_short' using errcode = '23514'; end if;
  if char_length(v) > 20 then raise exception 'username_too_long'  using errcode = '23514'; end if;

  n := public.username_norm(v);
  if n = any(reserved) then raise exception 'username_reserved' using errcode = '23514'; end if;
  if n = any(weak)     then raise exception 'username_profane'  using errcode = '23514'; end if;
  foreach w in array strong loop
    if position(w in n) > 0 then raise exception 'username_profane' using errcode = '23514'; end if;
  end loop;

  if exists (select 1 from public.profiles p where p.id <> new.id and lower(p.username) = lower(v)) then
    raise exception 'username_taken' using errcode = '23505';
  end if;

  return new;
end $$;
