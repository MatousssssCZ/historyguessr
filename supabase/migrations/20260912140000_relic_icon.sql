-- 2D ikona relikvie (AI) pro odznaky v žebříčku, dlaždice a profil. GLB zůstává pro velké 3D. Idempotentní.
alter table public.relics add column if not exists icon_url text;
