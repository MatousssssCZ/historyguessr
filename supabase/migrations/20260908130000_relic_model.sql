-- Volitelný 3D model (GLB) pro relikvii — jen pár vzácných kusů; jinak statický render.
alter table public.relics add column if not exists model_url text;
