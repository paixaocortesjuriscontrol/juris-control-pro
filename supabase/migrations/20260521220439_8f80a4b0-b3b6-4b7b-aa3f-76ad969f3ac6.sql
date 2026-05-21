DO $$
DECLARE
  v_coord uuid := '9d4e11e2-e81f-45ef-a8d4-977ddf371e18';
  v_inicio timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
  v_fim    timestamptz := (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 day') AT TIME ZONE 'America/Sao_Paulo';
  v_ids uuid[];
  v_hashes text[];
  v_ids_desc uuid[];
BEGIN
  SELECT array_agg(pd.id), array_agg(DISTINCT pd.hash_conteudo) FILTER (WHERE pd.hash_conteudo IS NOT NULL)
    INTO v_ids, v_hashes
  FROM public.publicacoes_djen pd
  JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
  WHERE md.coordenacao_id = v_coord
    AND (
      pd.created_at >= v_inicio AND pd.created_at < v_fim
      OR (pd.data_disponibilizacao IS NOT NULL AND pd.data_disponibilizacao >= v_inicio AND pd.data_disponibilizacao < v_fim)
      OR (pd.data_publicacao IS NOT NULL AND pd.data_publicacao >= v_inicio AND pd.data_publicacao < v_fim)
    );

  IF v_ids IS NOT NULL AND array_length(v_ids,1) > 0 THEN
    DELETE FROM public.publicacoes_djen_leituras WHERE publicacao_id = ANY(v_ids);
    DELETE FROM public.audiencias_detectadas    WHERE publicacao_id = ANY(v_ids);
    DELETE FROM public.tarefas_publicacoes      WHERE publicacao_id = ANY(v_ids);
    DELETE FROM public.publicacoes_djen_global_hash WHERE publicacao_id = ANY(v_ids);
    IF v_hashes IS NOT NULL AND array_length(v_hashes,1) > 0 THEN
      DELETE FROM public.publicacoes_djen_global_hash WHERE hash_global = ANY(v_hashes);
    END IF;
    DELETE FROM public.publicacoes_djen WHERE id = ANY(v_ids);
  END IF;

  SELECT array_agg(d.id) INTO v_ids_desc
  FROM public.publicacoes_djen_descartadas d
  JOIN public.monitoramentos_djen md ON md.id = d.monitoramento_id
  WHERE md.coordenacao_id = v_coord
    AND (
      d.created_at >= v_inicio AND d.created_at < v_fim
      OR (d.data_disponibilizacao IS NOT NULL AND d.data_disponibilizacao >= v_inicio AND d.data_disponibilizacao < v_fim)
      OR (d.data_publicacao IS NOT NULL AND d.data_publicacao >= v_inicio AND d.data_publicacao < v_fim)
    );

  IF v_ids_desc IS NOT NULL AND array_length(v_ids_desc,1) > 0 THEN
    DELETE FROM public.publicacoes_djen_descartadas WHERE id = ANY(v_ids_desc);
  END IF;

  RAISE NOTICE 'Removidas % publicações e % descartadas da coordenação Janaina (hoje).',
    COALESCE(array_length(v_ids,1),0), COALESCE(array_length(v_ids_desc,1),0);
END $$;