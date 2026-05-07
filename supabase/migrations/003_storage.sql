-- HistoryGuessr · Migrace 003 · Storage buckety
-- Spusť AFTER 002_rls.sql
-- Poznámka: Storage buckety lze také vytvořit v Supabase Dashboard → Storage

-- ── Storage buckety ───────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('panorama', 'panorama', true, 52428800, array['image/jpeg', 'image/png', 'image/webp']),
  ('events',   'events',   true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ── Storage RLS ───────────────────────────────────────────

-- Panorama bucket: čtení pro všechny přihlášené, upload pouze admin
create policy "panorama: public read"
  on storage.objects for select
  using (bucket_id = 'panorama');

create policy "panorama: admin upload"
  on storage.objects for insert
  with check (
    bucket_id = 'panorama'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "panorama: admin update"
  on storage.objects for update
  using (
    bucket_id = 'panorama'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "panorama: admin delete"
  on storage.objects for delete
  using (
    bucket_id = 'panorama'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Events bucket (doplňkové obrázky): stejná pravidla
create policy "events-img: public read"
  on storage.objects for select
  using (bucket_id = 'events');

create policy "events-img: admin upload"
  on storage.objects for insert
  with check (
    bucket_id = 'events'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "events-img: admin update"
  on storage.objects for update
  using (
    bucket_id = 'events'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "events-img: admin delete"
  on storage.objects for delete
  using (
    bucket_id = 'events'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
