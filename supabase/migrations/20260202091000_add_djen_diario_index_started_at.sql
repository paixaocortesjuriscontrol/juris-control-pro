ALTER TABLE public.djen_diario_index
ADD COLUMN IF NOT EXISTS started_at timestamptz;
