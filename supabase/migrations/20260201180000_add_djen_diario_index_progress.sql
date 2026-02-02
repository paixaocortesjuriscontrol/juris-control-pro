ALTER TABLE public.djen_diario_index
ADD COLUMN IF NOT EXISTS total_tribunais integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS tribunais_processados integer DEFAULT 0;
