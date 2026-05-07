-- HistoryGuessr · Migrace 001 · Schéma
-- Spusť v Supabase → SQL Editor

-- ── Profiles (rozšíření auth.users) ──────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique,
  avatar_url  text,
  role        text not null default 'user' check (role in ('user', 'admin')),
  total_score bigint not null default 0,
  games_played int not null default 0,
  created_at  timestamptz not null default now()
);

-- Automaticky vytvoř profil po registraci
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Events (historické události) ─────────────────────────
create table public.events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text not null,
  year            int not null,
  lat             double precision not null,
  lng             double precision not null,
  panorama_url    text not null,
  event_image_url text,
  category        text,
  difficulty      int not null default 2 check (difficulty between 1 and 3),
  published       boolean not null default false,
  play_count      int not null default 0,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_updated_at
  before update on public.events
  for each row execute function public.update_updated_at();

-- ── Game sessions ─────────────────────────────────────────
create table public.game_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  total_score int,
  rounds      jsonb not null default '[]'::jsonb,
  mode        text not null default 'classic' check (mode in ('classic'))
);

-- ── RPC: přičtení skóre k profilu (atomicky) ─────────────
create or replace function public.increment_user_score(p_user_id uuid, p_score int)
returns void language plpgsql security definer as $$
begin
  update public.profiles
  set total_score   = total_score + p_score,
      games_played  = games_played + 1
  where id = p_user_id;
end;
$$;

-- ── RPC: validace skóre (ochrana před cheatingem) ─────────
-- Trigger ověřuje, že total_score odpovídá součtu kol
create or replace function public.validate_game_session()
returns trigger language plpgsql as $$
declare
  computed_score int;
begin
  -- Spočítej součet round_score z jsonb
  select coalesce(sum((r->>'round_score')::int), 0)
  into computed_score
  from jsonb_array_elements(new.rounds) as r;

  -- Maximální skóre za kolo je 10 000, max 5 kol
  if new.total_score > 50000 then
    raise exception 'Neplatné skóre: překračuje maximum';
  end if;

  -- Skóre musí odpovídat součtu kol (tolerance ±1 kvůli zaokrouhlování)
  if new.total_score is not null and abs(new.total_score - computed_score) > 1 then
    raise exception 'Neplatné skóre: neshoduje se se součtem kol';
  end if;

  return new;
end;
$$;

create trigger validate_game_session_score
  before insert or update on public.game_sessions
  for each row
  when (new.finished_at is not null)
  execute function public.validate_game_session();
