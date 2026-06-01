ALTER TABLE public.materias_benner ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'Dicionário Banco';

UPDATE public.materias_benner SET tipo = 'Dicionário Banco' WHERE tipo IS NULL OR tipo = '';

ALTER TABLE public.materias_benner DROP CONSTRAINT IF EXISTS materias_benner_tipo_check;
ALTER TABLE public.materias_benner ADD CONSTRAINT materias_benner_tipo_check CHECK (tipo IN ('Dicionário Banco', 'Advogado'));