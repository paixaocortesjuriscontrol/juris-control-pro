CREATE OR REPLACE FUNCTION public.atualizar_distribuicoes_tst_json(p_dados jsonb)
RETURNS TABLE(atualizados integer, nao_encontrados integer, dossies_nao_encontrados text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_atualizados integer := 0;
  v_dossies_input text[];
  v_dossies_match text[];
  v_dossies_miss text[];
BEGIN
  -- Coleta dossiês de entrada
  SELECT array_agg(DISTINCT (item->>'dossie'))
  INTO v_dossies_input
  FROM jsonb_array_elements(p_dados) item
  WHERE item->>'dossie' IS NOT NULL;

  -- Aplica UPDATE
  WITH src AS (
    SELECT
      item->>'dossie' AS dossie,
      NULLIF(item->>'tribunal','') AS tribunal,
      NULLIF(item->>'tipo_recurso','') AS tipo_recurso,
      NULLIF(item->>'data_distribuicao_real','')::date AS data_distribuicao_real,
      NULLIF(item->>'turma','') AS turma,
      NULLIF(item->>'relator','') AS relator
    FROM jsonb_array_elements(p_dados) item
  ),
  updated AS (
    UPDATE public.dados_benner db
    SET
      tribunal = COALESCE(s.tribunal, db.tribunal),
      tipo_recurso = COALESCE(s.tipo_recurso, db.tipo_recurso),
      data_distribuicao_real = COALESCE(s.data_distribuicao_real, db.data_distribuicao_real),
      turma = COALESCE(s.turma, db.turma),
      relator = COALESCE(s.relator, db.relator),
      benner_atualizado = TRUE,
      updated_at = now()
    FROM src s
    WHERE db.dossie = s.dossie
      AND db.aba_origem IS NOT NULL
    RETURNING db.dossie
  )
  SELECT COUNT(*)::int, array_agg(DISTINCT dossie)
  INTO v_atualizados, v_dossies_match
  FROM updated;

  -- Calcula dossiês não encontrados
  SELECT array_agg(d) INTO v_dossies_miss
  FROM unnest(v_dossies_input) d
  WHERE d <> ALL(COALESCE(v_dossies_match, ARRAY[]::text[]));

  RETURN QUERY SELECT
    v_atualizados,
    COALESCE(array_length(v_dossies_miss, 1), 0),
    COALESCE(v_dossies_miss, ARRAY[]::text[]);
END;
$$;