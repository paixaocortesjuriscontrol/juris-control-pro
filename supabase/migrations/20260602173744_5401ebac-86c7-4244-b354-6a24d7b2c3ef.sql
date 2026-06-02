ALTER TABLE public.monitoramentos_djen
ADD COLUMN IF NOT EXISTS paginacao_paralela boolean NOT NULL DEFAULT false;