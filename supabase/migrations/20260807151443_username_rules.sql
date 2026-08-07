-- HistoryGuessr · Serverové vynucení pravidel přezdívky
--
-- Klient (src/lib/username.ts) validuje pro UX; tenhle trigger je AUTORITA —
-- platí i při přímém API zápisu (nejde obejít). Kontroluje délku, rezervovaná
-- jména, vulgarity a case-insensitive unikátnost.
--
-- Chyby vyhazuje s SQLSTATE, které klient už umí:
--   23505 (unique_violation) → „přezdívka obsazená" (case-insensitive kolize)
--   23514 (check_violation)  → neplatné jméno (délka/rezervované/vulgární)
--
-- Idempotentní. Testuj lokálně `supabase db reset`, pak spusť na produkci.

-- Normalizace pro porovnání: malá písmena, leet→písmeno, pryč vše kromě alnum.
-- ([[:alnum:]] v UTF-8 Postgresu bere i písmena s diakritikou.)
create or replace function public.username_norm(u text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(
    translate(lower(coalesce(u, '')), '013457@$', 'oieastas'),
    '[^[:alnum:]]', '', 'g'
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
  bad text[] := array[
    'kurva','kurwa','pica','piča','curak','čurák','debil','kokot','mrdka','mrdat',
    'hovno','prdel','sracka','zmrd','buzna','buzerant','cigan','cikan',
    'fuck','shit','bitch','cunt','asshole','nigger','nigga','faggot','whore','slut','pussy','rape',
    'scheisse','arschloch','fotze','wichser','hurensohn','schlampe','nutte','nazi'
  ];
begin
  if new.username is null then return new; end if;

  new.username := v;                       -- normalizovaná hodnota se i uloží
  if char_length(v) < 3  then raise exception 'username_too_short' using errcode = '23514'; end if;
  if char_length(v) > 20 then raise exception 'username_too_long'  using errcode = '23514'; end if;

  n := public.username_norm(v);
  if n = any(reserved) then raise exception 'username_reserved' using errcode = '23514'; end if;
  foreach w in array bad loop
    if position(w in n) > 0 then raise exception 'username_profane' using errcode = '23514'; end if;
  end loop;

  -- Case-insensitive unikátnost (Admin = admin)
  if exists (select 1 from public.profiles p where p.id <> new.id and lower(p.username) = lower(v)) then
    raise exception 'username_taken' using errcode = '23505';
  end if;

  return new;
end $$;

drop trigger if exists trg_enforce_username on public.profiles;
create trigger trg_enforce_username
  before insert or update of username on public.profiles
  for each row execute function public.enforce_username();

-- ── Volitelné zpřísnění (spusť RUČNĚ až po vyřešení případných duplicit) ──
--   Najdi case-insensitive duplicity na produkci:
--     select lower(username) lu, count(*) from public.profiles
--      where username is not null group by lu having count(*) > 1;
--   Když žádné nejsou, tvrdý index (chrání i proti souběhu):
--     create unique index concurrently if not exists profiles_username_ci_uk
--       on public.profiles (lower(username)) where username is not null;
