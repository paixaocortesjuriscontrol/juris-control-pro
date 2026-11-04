CREATE OR REPLACE FUNCTION public.garantir_publicacao_unificada(p_servidor_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; v_id uuid; v_uid uuid := auth.uid();
BEGIN
  IF EXISTS (SELECT 1 FROM publicacoes_djen WHERE id = p_servidor_id) THEN RETURN p_servidor_id; END IF;
  SELECT * INTO s FROM publicacoes_djen_servidor WHERE id = p_servidor_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_uid IS NOT NULL AND NOT (
       EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_uid AND role IN ('admin','assistente_juridico_geral'))
       OR EXISTS (SELECT 1 FROM membros_coordenacao WHERE user_id = v_uid AND coordenacao_id = s.coordenacao_id)
  ) THEN RAISE EXCEPTION 'Sem acesso à coordenação desta publicação'; END IF;
  IF s.id_djen IS NOT NULL THEN
    SELECT id INTO v_id FROM publicacoes_djen WHERE id_djen = s.id_djen
      ORDER BY (coordenacao_id IS NOT DISTINCT FROM s.coordenacao_id) DESC LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  IF s.dedup_key IS NOT NULL THEN
    SELECT id INTO v_id FROM publicacoes_djen WHERE dedup_key = s.dedup_key LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  BEGIN
    INSERT INTO publicacoes_djen (id, monitoramento_id, hash_conteudo, data_publicacao, data_disponibilizacao, processo_numero,
      conteudo, fonte, tribunal, polo_ativo, polo_passivo, orgao, tipo_comunicacao, meio, advogados_json, partes_json,
      coordenacao_id, tipo_publicacao, id_djen, kurier_login, execucao_id, created_at, lida)
    VALUES (s.id, s.monitoramento_id, s.hash_conteudo, s.data_publicacao, s.data_disponibilizacao, s.processo_numero,
      s.conteudo, s.fonte, s.tribunal, s.polo_ativo, s.polo_passivo, s.orgao, s.tipo_comunicacao, s.meio, s.advogados_json,
      COALESCE(s.partes_json,'[]'::jsonb), s.coordenacao_id, COALESCE(s.tipo_publicacao,'intimacao'), s.id_djen, s.kurier_login,
      NULL, s.created_at, true)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_id FROM publicacoes_djen WHERE dedup_key = s.dedup_key OR hash_conteudo = s.hash_conteudo LIMIT 1;
  END;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.garantir_publicacao_unificada(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.garantir_publicacao_unificada(uuid) TO authenticated, service_role;