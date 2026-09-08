-- % hráčů, kteří mají v kategorii daný titul (nebo vyšší) = podíl hráčů
-- s počtem kol ≥950 nad zadaným prahem. Hlavní signál vzácnosti titulu (33a).
-- Vstup: { "war": 10, "moments": 20, ... } (práh = počet kol aktuálního titulu).
-- Výstup: { "war": 24.0, "moments": 11.0, ... } (procenta, zaokrouhleno na 0,1).
create or replace function public.title_ownership(p_thresholds jsonb)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to 'public'
as $$
declare
  k text; v int; total int; cnt int;
  res jsonb := '{}'::jsonb;
begin
  select count(distinct user_id) into total from public.user_category_hits;
  if coalesce(total, 0) = 0 then return res; end if;
  for k, v in select key, greatest((value)::int, 1) from jsonb_each_text(p_thresholds) loop
    select count(*) into cnt
      from public.user_category_hits
     where category = k and hits >= v;
    res := res || jsonb_build_object(k, round(cnt::numeric / total * 100, 1));
  end loop;
  return res;
end;
$$;

grant execute on function public.title_ownership(jsonb) to anon, authenticated;
