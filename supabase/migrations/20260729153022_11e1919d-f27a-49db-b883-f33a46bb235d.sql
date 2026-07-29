ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS empresa_terceirizada text,
  ADD COLUMN IF NOT EXISTS processos_relacionados text,
  ADD COLUMN IF NOT EXISTS segredo_justica boolean;