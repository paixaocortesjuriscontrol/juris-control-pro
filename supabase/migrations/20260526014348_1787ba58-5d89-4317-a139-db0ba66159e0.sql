ALTER TABLE public.kurier_publicacoes_raw 
  ADD COLUMN IF NOT EXISTS motivo_descarte text;

CREATE INDEX IF NOT EXISTS idx_kurier_raw_motivo_descarte
  ON public.kurier_publicacoes_raw(motivo_descarte)
  WHERE motivo_descarte IS NOT NULL;