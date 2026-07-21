DO $$
DECLARE
  r record;
  def text;
  new_def text;
BEGIN
  FOR r IN
    SELECT oid, proname, pg_get_functiondef(oid) AS definition
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('get_djen_publicacoes_unificadas', 'get_djen_descartadas_dedup')
  LOOP
    def := r.definition;
    new_def := def;

    -- publicacoes_djen (termos/kurier): buscar também em advogados_json e partes_json.
    new_def := replace(
      new_def,
      'OR md.termo_busca ILIKE (''%''||v_q||''%'')
           OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pd.processo_numero,''''),''[^0-9]'','''',''g'') LIKE (''%''||v_q_digits||''%'')))',
      'OR md.termo_busca ILIKE (''%''||v_q||''%'')
           OR pd.advogados_json::text ILIKE (''%''||v_q||''%'')
           OR pd.partes_json::text ILIKE (''%''||v_q||''%'')
           OR COALESCE(pd.polo_ativo,'''') ILIKE (''%''||v_q||''%'')
           OR COALESCE(pd.polo_passivo,'''') ILIKE (''%''||v_q||''%'')
           OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pd.processo_numero,''''),''[^0-9]'','''',''g'') LIKE (''%''||v_q_digits||''%'')))'
    );

    -- publicacoes_djen_processos: buscar também em advogados_json e partes_json.
    new_def := replace(
      new_def,
      'OR COALESCE(p.polo_ativo,'''') ILIKE (''%''||v_q||''%'') OR COALESCE(p.polo_passivo,'''') ILIKE (''%''||v_q||''%'')
            OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pdp.processo_numero,''''),''[^0-9]'','''',''g'') LIKE (''%''||v_q_digits||''%'')))',
      'OR COALESCE(p.polo_ativo,'''') ILIKE (''%''||v_q||''%'') OR COALESCE(p.polo_passivo,'''') ILIKE (''%''||v_q||''%'')
            OR pdp.advogados_json::text ILIKE (''%''||v_q||''%'')
            OR pdp.partes_json::text ILIKE (''%''||v_q||''%'')
            OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(pdp.processo_numero,''''),''[^0-9]'','''',''g'') LIKE (''%''||v_q_digits||''%'')))'
    );

    -- publicacoes_djen_descartadas (assinatura antiga): buscar também em advogados_json e partes_json.
    new_def := replace(
      new_def,
      'OR d.descartado_por_nome ILIKE (''%'' || v_q || ''%'')
        OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(d.processo_numero, ''''), ''[^0-9]'', '''', ''g'') LIKE (''%'' || v_q_digits || ''%''))',
      'OR d.descartado_por_nome ILIKE (''%'' || v_q || ''%'')
        OR d.advogados_json::text ILIKE (''%'' || v_q || ''%'')
        OR d.partes_json::text ILIKE (''%'' || v_q || ''%'')
        OR (v_q_digits IS NOT NULL AND regexp_replace(COALESCE(d.processo_numero, ''''), ''[^0-9]'', '''', ''g'') LIKE (''%'' || v_q_digits || ''%''))'
    );

    IF new_def IS DISTINCT FROM def THEN
      EXECUTE new_def;
    END IF;
  END LOOP;
END $$;