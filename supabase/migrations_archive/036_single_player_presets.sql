-- HistoryGuessr · Migrace 036 · Single Player Studio (scénáře)
--
-- Zadání (bod 11): Premium umí uložit vlastní nastavení jako scénář, upravit ho,
-- duplikovat, smazat, rychle spustit a případně sdílet odkazem.
--
-- KLÍČOVÉ: scénář ukládá PRAVIDLA VÝBĚRU (jsonb), ne pevný seznam událostí —
-- jinak by zestárl, jakmile přibude obsah. Výjimka je, když hráč výslovně zvolí
-- konkrétní události (rules.exactEventIds) — to je jeho explicitní volba.
--
-- Bezpečnost: scénář patří svému vlastníkovi; cizí ho nesmí číst ani měnit.
-- Sdílený scénář je čitelný jen přes svůj share_slug (ne výpisem cizích scénářů).
--
-- Spusť v Supabase SQL editoru. Idempotentní.

-- ─────────────────────────────────────────────────────────
-- 1) Tabulka scénářů
-- ─────────────────────────────────────────────────────────
create table if not exists public.single_player_presets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 60),
  -- Pravidla výběru: { rounds, categories[], yearFrom, yearTo, excludeIds[],
  --                    exactEventIds[], onlyUnplayed, onlyMistakes }
  rules      jsonb not null default '{}'::jsonb,
  is_shared  boolean not null default false,
  share_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sp_presets_user on public.single_player_presets(user_id, updated_at desc);

alter table public.single_player_presets enable row level security;

-- Vlastník: plný přístup ke svým scénářům
drop policy if exists "sp: own all" on public.single_player_presets;
create policy "sp: own all" on public.single_player_presets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.single_player_presets to authenticated;

-- ─────────────────────────────────────────────────────────
-- 2) Sdílení odkazem
--     Sdílený scénář se NEDÁ vylistovat — jen adresně přes slug.
-- ─────────────────────────────────────────────────────────
create or replace function public.get_shared_preset(p_slug text)
returns table (id uuid, name text, rules jsonb, owner_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.rules, pr.username
    from public.single_player_presets p
    left join public.profiles pr on pr.id = p.user_id
   where p.share_slug = p_slug and p.is_shared = true
$$;
grant execute on function public.get_shared_preset(text) to authenticated, anon;

/** Zapne/vypne sdílení a vrátí slug. Jen vlastník. */
create or replace function public.set_preset_shared(p_preset_id uuid, p_shared boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_slug text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.single_player_presets
                  where id = p_preset_id and user_id = v_uid) then
    raise exception 'forbidden';
  end if;

  if not p_shared then
    update public.single_player_presets
       set is_shared = false, updated_at = now()
     where id = p_preset_id;
    return null;
  end if;

  select share_slug into v_slug from public.single_player_presets where id = p_preset_id;
  if v_slug is null then
    -- krátký náhodný slug (bez závislosti na rozšířeních)
    v_slug := lower(replace(encode(gen_random_bytes(6), 'base64'), '/', '_'));
    v_slug := replace(replace(v_slug, '+', '-'), '=', '');
  end if;

  update public.single_player_presets
     set is_shared = true, share_slug = v_slug, updated_at = now()
   where id = p_preset_id;
  return v_slug;
end;
$$;
grant execute on function public.set_preset_shared(uuid, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────
-- 3) Podklad pro Premium filtr „jen dříve chybně určené"
--     Bere z vlastních dohraných her (game_sessions.rounds).
-- ─────────────────────────────────────────────────────────
create or replace function public.my_mistake_event_ids(p_max_score int default 500)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct (r->>'event_id')::uuid), '{}')
    from public.game_sessions gs
    cross join lateral jsonb_array_elements(coalesce(gs.rounds, '[]'::jsonb)) r
   where gs.user_id = auth.uid()
     and gs.finished_at is not null
     and (r->>'round_score')::int < p_max_score
$$;
grant execute on function public.my_mistake_event_ids(int) to authenticated;

/** Události, které už hráč v dohraných hrách viděl (pro filtr „jen nehrané"). */
create or replace function public.my_played_event_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct (r->>'event_id')::uuid), '{}')
    from public.game_sessions gs
    cross join lateral jsonb_array_elements(coalesce(gs.rounds, '[]'::jsonb)) r
   where gs.user_id = auth.uid()
     and gs.finished_at is not null
$$;
grant execute on function public.my_played_event_ids() to authenticated;
