-- Adicionar campos para hora local e hora Brasília
ALTER TABLE public.audiencias_detectadas
ADD COLUMN IF NOT EXISTS hora_local text,
ADD COLUMN IF NOT EXISTS hora_brasilia text;

-- Migrar dados existentes do campo hora para hora_local
UPDATE public.audiencias_detectadas
SET hora_local = hora, hora_brasilia = hora
WHERE hora IS NOT NULL AND hora_local IS NULL;