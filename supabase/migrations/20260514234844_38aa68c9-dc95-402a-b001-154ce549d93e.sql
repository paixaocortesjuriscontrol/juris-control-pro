
DO $$
DECLARE
  v_coord uuid := '9d4e11e2-e81f-45ef-a8d4-977ddf371e18';
  v_pub_ids uuid[];
  v_hashes text[];
  v_desc_ids uuid[];
BEGIN
  -- IDs das publicações de hoje desta coordenação
  SELECT array_agg(p.id), array_agg(p.hash_conteudo)
    INTO v_pub_ids, v_hashes
  FROM publicacoes_djen p
  JOIN monitoramentos_djen m ON m.id = p.monitoramento_id
  WHERE m.coordenacao_id = v_coord
    AND p.created_at::date = CURRENT_DATE;

  IF v_pub_ids IS NOT NULL THEN
    DELETE FROM publicacoes_djen_leituras WHERE publicacao_id = ANY(v_pub_ids);
    DELETE FROM audiencias_detectadas WHERE publicacao_id = ANY(v_pub_ids);
    DELETE FROM tarefas_publicacoes WHERE publicacao_id = ANY(v_pub_ids);
    DELETE FROM publicacoes_djen_global_hash WHERE publicacao_id = ANY(v_pub_ids);
    IF v_hashes IS NOT NULL THEN
      DELETE FROM publicacoes_djen_global_hash WHERE hash_global = ANY(v_hashes);
    END IF;
    DELETE FROM publicacoes_djen WHERE id = ANY(v_pub_ids);
  END IF;

  -- Descartadas de hoje desta coordenação
  SELECT array_agg(d.id) INTO v_desc_ids
  FROM publicacoes_djen_descartadas d
  JOIN monitoramentos_djen m ON m.id = d.monitoramento_id
  WHERE m.coordenacao_id = v_coord
    AND d.created_at::date = CURRENT_DATE;

  IF v_desc_ids IS NOT NULL THEN
    DELETE FROM publicacoes_djen_descartadas WHERE id = ANY(v_desc_ids);
  END IF;
END $$;
