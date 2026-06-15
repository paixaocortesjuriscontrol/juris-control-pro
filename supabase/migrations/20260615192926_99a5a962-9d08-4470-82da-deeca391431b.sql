ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS ia_campos_distribuicao text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS ia_campos_benner text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN public.dados_benner.ia_campos_distribuicao IS 'Campos da aba Distribuição TST preenchidos/sugeridos por IA para reconstrução visual da marca IA.';
COMMENT ON COLUMN public.dados_benner.ia_campos_benner IS 'Campos exclusivos Dados Benner preenchidos/sugeridos por IA para reconstrução visual da marca IA.';