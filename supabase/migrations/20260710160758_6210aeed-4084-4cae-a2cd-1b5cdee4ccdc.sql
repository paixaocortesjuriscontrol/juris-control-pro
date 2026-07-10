
CREATE OR REPLACE FUNCTION public.deve_rodar_monitoramento(p_tipo TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hora TIME;
  v_col_ativo TEXT;
  v_col_hor TEXT;
  v_count INT;
  v_sql TEXT;
BEGIN
  v_hora := (date_trunc('hour', (now() AT TIME ZONE 'America/Sao_Paulo'))::time);

  CASE p_tipo
    WHEN 'andamentos'        THEN v_col_ativo := 'monitorar_andamentos';        v_col_hor := 'horarios_andamentos';
    WHEN 'djen_termos'       THEN v_col_ativo := 'monitorar_djen_termos';       v_col_hor := 'horarios_djen_termos';
    WHEN 'termos'            THEN v_col_ativo := 'monitorar_djen_termos';       v_col_hor := 'horarios_djen_termos';
    WHEN 'djen_processos'    THEN v_col_ativo := 'monitorar_djen_processos';    v_col_hor := 'horarios_djen_processos';
    WHEN 'distribuicoes'     THEN v_col_ativo := 'monitorar_distribuicoes';     v_col_hor := 'horarios_distribuicoes';
    WHEN 'redistribuicoes'   THEN v_col_ativo := 'monitorar_redistribuicoes';   v_col_hor := 'horarios_redistribuicoes';
    WHEN 'djet_pautas'       THEN v_col_ativo := 'monitorar_djet_pautas';       v_col_hor := 'horarios_djet_pautas';
    ELSE RETURN FALSE;
  END CASE;

  v_sql := format(
    'SELECT COUNT(*) FROM public.config_deteccao_coordenacao WHERE %I = TRUE AND %L = ANY(%I)',
    v_col_ativo, v_hora, v_col_hor
  );
  EXECUTE v_sql INTO v_count;
  RETURN v_count > 0;
END; $$;

GRANT EXECUTE ON FUNCTION public.deve_rodar_monitoramento(TEXT) TO authenticated, service_role, anon;
