CREATE OR REPLACE FUNCTION public.buscar_teses_aplicaveis(
  p_processo_id uuid,
  p_tipo_peca text DEFAULT NULL,
  p_limite int DEFAULT 5
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_processo RECORD;
  v_result jsonb;
BEGIN
  SELECT numero, classe, assunto, area, tribunal, vara, valor, resultado
    INTO v_processo
    FROM public.processos
    WHERE id = p_processo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo não encontrado';
  END IF;

  WITH ranked AS (
    SELECT
      t.*,
      CASE
        WHEN p_tipo_peca IS NOT NULL AND t.tipo_peca = p_tipo_peca THEN 100
        WHEN p_tipo_peca IS NOT NULL AND t.tipo_peca = 'outros' THEN 30
        WHEN p_tipo_peca IS NULL THEN 50
        ELSE 0
      END AS score_tipo,
      (
        CASE WHEN v_processo.assunto IS NOT NULL AND t.assunto_cnj ILIKE '%' || v_processo.assunto || '%' THEN 40 ELSE 0 END +
        CASE WHEN v_processo.assunto IS NOT NULL AND t.materia ILIKE '%' || v_processo.assunto || '%' THEN 30 ELSE 0 END +
        CASE WHEN v_processo.assunto IS NOT NULL AND t.fundamentos ILIKE '%' || v_processo.assunto || '%' THEN 20 ELSE 0 END +
        CASE WHEN v_processo.classe IS NOT NULL AND t.fundamentos ILIKE '%' || v_processo.classe || '%' THEN 10 ELSE 0 END +
        CASE WHEN v_processo.assunto IS NOT NULL AND t.assunto_cnj ILIKE '%' || v_processo.assunto || '%' THEN 5 ELSE 0 END
      ) AS score_conteudo
    FROM public.teses_juridicas t
    WHERE t.ativo = true
  ),
  top_teses AS (
    SELECT *
    FROM ranked
    ORDER BY (score_tipo + score_conteudo) DESC
    LIMIT p_limite
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'titulo', titulo,
      'tipo_peca', tipo_peca,
      'area', area,
      'materia', materia,
      'assunto_cnj', assunto_cnj,
      'fundamentos', fundamentos,
      'tipo_recurso', tipo_recurso,
      'tags', tags,
      'score', score_tipo + score_conteudo
    )
  ), '[]'::jsonb)
  INTO v_result
  FROM top_teses;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.buscar_teses_aplicaveis(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.buscar_teses_aplicaveis(uuid, text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.buscar_teses_aplicaveis(uuid, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_teses_aplicaveis(uuid, text, int) TO service_role;