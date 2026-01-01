-- Add column to store original situation when it doesn't match the enum
ALTER TABLE public.processos 
ADD COLUMN IF NOT EXISTS situacao_original text NULL;

COMMENT ON COLUMN public.processos.situacao_original IS 'Stores the original situation value from import when it does not match standard enum values';