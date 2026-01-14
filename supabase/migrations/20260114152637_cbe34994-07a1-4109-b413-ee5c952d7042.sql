-- Corrige schema para permitir que a edge function monitorar-djen grave os dados corretamente

ALTER TABLE public.publicacoes_djen
  ADD COLUMN IF NOT EXISTS tribunal text,
  ADD COLUMN IF NOT EXISTS polo_ativo text,
  ADD COLUMN IF NOT EXISTS polo_passivo text;

ALTER TABLE public.publicacoes_djen_descartadas
  ADD COLUMN IF NOT EXISTS data_disponibilizacao timestamptz,
  ADD COLUMN IF NOT EXISTS tribunal text;