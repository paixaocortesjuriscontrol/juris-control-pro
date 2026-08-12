DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_notificacoes_counts_by_coordenacao'
    AND pg_get_function_identity_arguments(p.oid) = 'p_coordenacao_ids uuid[], p_periodo_inicio date, p_periodo_fim date, p_status_filter text, p_prioridade_filter text, p_search_query text';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'Função de contagem não encontrada';
  END IF;

  v_definition := replace(v_definition, 'COALESCE(id.coordenacao_id, p.coordenacao_id)', 'p.coordenacao_id');
  EXECUTE v_definition;
END;
$migration$;