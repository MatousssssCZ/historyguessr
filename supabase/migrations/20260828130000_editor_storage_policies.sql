-- Editoři musí smět nahrávat/nahrazovat soubory v bucketech `panorama` a `events`,
-- jinak upload panoramatu z /editoru padá na "new row violates row-level security policy".
--
-- Storage politiky se dřív nastavily jen pro admina (v dashboardu), role „editor"
-- vznikla později. Tady je doplníme přes SQL. `public.is_editor()` = editor NEBO admin,
-- takže adminovi to nic nebere (permisivní politiky se OR-ují).
--
-- Idempotentní (drop if exists). Pokud SQL editor odmítne s "must be owner of table
-- objects", vytvoř tytéž politiky přes Storage → Policies v dashboardu.

-- ── bucket: panorama ────────────────────────────────────────────────────────
drop policy if exists "panorama: staff insert" on storage.objects;
create policy "panorama: staff insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'panorama' and public.is_editor());

drop policy if exists "panorama: staff update" on storage.objects;
create policy "panorama: staff update" on storage.objects for update to authenticated
  using (bucket_id = 'panorama' and public.is_editor())
  with check (bucket_id = 'panorama' and public.is_editor());

drop policy if exists "panorama: staff delete" on storage.objects;
create policy "panorama: staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'panorama' and public.is_editor());

drop policy if exists "panorama: staff select" on storage.objects;
create policy "panorama: staff select" on storage.objects for select to authenticated
  using (bucket_id = 'panorama' and public.is_editor());

-- ── bucket: events ──────────────────────────────────────────────────────────
drop policy if exists "events-bucket: staff insert" on storage.objects;
create policy "events-bucket: staff insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'events' and public.is_editor());

drop policy if exists "events-bucket: staff update" on storage.objects;
create policy "events-bucket: staff update" on storage.objects for update to authenticated
  using (bucket_id = 'events' and public.is_editor())
  with check (bucket_id = 'events' and public.is_editor());

drop policy if exists "events-bucket: staff delete" on storage.objects;
create policy "events-bucket: staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'events' and public.is_editor());

drop policy if exists "events-bucket: staff select" on storage.objects;
create policy "events-bucket: staff select" on storage.objects for select to authenticated
  using (bucket_id = 'events' and public.is_editor());
