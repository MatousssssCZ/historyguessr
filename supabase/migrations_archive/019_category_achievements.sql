-- HistoryGuessr · Migrace 019 · Počítadla achievementů podle kategorie
--
-- Pro každého hráče a kategonii počítáme, kolikrát měl v kole skóre >= 950.
-- Zapisuje výhradně RPC record_category_hit (SECURITY DEFINER) — práh i
-- kategorie se ověřují na serveru, nedá se podvádět přímým zápisem.
--
-- Spusť v Supabase SQL editoru. Idempotentní.

create table if not exists public.user_category_hits (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  hits     int  not null default 0,
  primary key (user_id, category)
);

alter table public.user_category_hits enable row level security;

drop policy if exists "uch: select own" on public.user_category_hits;
create policy "uch: select own"
  on public.user_category_hits for select
  using (auth.uid() = user_id);

grant select on public.user_category_hits to authenticated;

-- Práh úspěšného kola = 950 bodů. Zápis jen přes tuto funkci.
create or replace function public.record_category_hit(
  p_event_id uuid,
  p_round_score int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat text;
begin
  if auth.uid() is null or p_round_score < 950 then
    return;
  end if;

  select category into v_cat from public.events where id = p_event_id;
  if v_cat is null then
    return;
  end if;

  insert into public.user_category_hits (user_id, category, hits)
  values (auth.uid(), v_cat, 1)
  on conflict (user_id, category)
  do update set hits = public.user_category_hits.hits + 1;
end;
$$;

grant execute on function public.record_category_hit(uuid, int) to authenticated;
