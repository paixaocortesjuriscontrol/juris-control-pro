DROP FUNCTION IF EXISTS public.arquivar_dados_benner(uuid, text);

CREATE OR REPLACE FUNCTION public.arquivar_dados_benner(_id uuid, _motivo text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.dados_benner%ROWTYPE;
  _snapshot jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO _row FROM public.dados_benner WHERE id = _id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ficha não encontrada';
  END IF;

  _snapshot := to_jsonb(_row) || jsonb_build_object(
    'responsaveis', COALESCE((SELECT jsonb_agg(r.responsavel_id) FROM public.dados_benner_responsaveis r WHERE r.dados_benner_id = _row.id), '[]'::jsonb),
    'tags', COALESCE((SELECT jsonb_agg(t.tag_id) FROM public.dados_benner_processo_tags t WHERE t.dados_benner_id = _row.id), '[]'::jsonb)
  );

  INSERT INTO public.dados_benner_arquivados
    (dados_benner_id, processo, dossie, aba_origem, coordenacao_id, snapshot, arquivado_por, motivo)
  VALUES
    (_row.id, _row.processo, _row.dossie, _row.aba_origem, _row.coordenacao_id, _snapshot, auth.uid(), _motivo);

  DELETE FROM public.dados_benner WHERE id = _row.id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.arquivar_dados_benner(uuid, text) TO authenticated;