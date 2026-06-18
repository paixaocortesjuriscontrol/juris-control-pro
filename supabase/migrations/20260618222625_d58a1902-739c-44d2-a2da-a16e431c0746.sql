
CREATE OR REPLACE FUNCTION public.get_dados_benner_arquivados_duplicados()
RETURNS TABLE (
  id uuid,
  processo text,
  dossie text,
  aba_origem text,
  coordenacao_id uuid,
  arquivado_em timestamptz,
  snapshot jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.processo, a.dossie, a.aba_origem, a.coordenacao_id, a.arquivado_em, a.snapshot
  FROM public.dados_benner_arquivados a
  WHERE a.processo IS NOT NULL AND btrim(a.processo) <> '';
$$;

GRANT EXECUTE ON FUNCTION public.get_dados_benner_arquivados_duplicados() TO authenticated;
