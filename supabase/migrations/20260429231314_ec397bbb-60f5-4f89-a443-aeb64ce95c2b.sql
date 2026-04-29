DO $$
DECLARE
  v_coord_id uuid;
  v_inicio timestamptz := TIMESTAMPTZ '2026-04-29 03:00:00Z';
  v_fim    timestamptz := TIMESTAMPTZ '2026-04-30 02:59:59.999Z';
BEGIN
  SELECT id INTO v_coord_id
  FROM public.coordenacoes
  WHERE nome ILIKE '%Renata%Santander%'
  LIMIT 1;

  IF v_coord_id IS NULL THEN
    RAISE EXCEPTION 'Coordenação Renata Santander não encontrada';
  END IF;

  -- IDs alvo: encontradas hoje na coordenação Renata
  CREATE TEMP TABLE tmp_alvo_djen AS
  SELECT pd.id
  FROM public.publicacoes_djen pd
  WHERE pd.coordenacao_id = v_coord_id
    AND pd.status = 'encontrada'
    AND pd.created_at >= v_inicio
    AND pd.created_at <= v_fim;

  -- Limpar dependências antes do delete
  DELETE FROM public.publicacoes_djen_leituras l
  WHERE l.publicacao_id IN (SELECT id FROM tmp_alvo_djen);

  DELETE FROM public.publicacoes_djen_global_hash g
  WHERE g.publicacao_id IN (SELECT id FROM tmp_alvo_djen);

  -- audiencias_detectadas e tarefas_publicacoes têm ON DELETE CASCADE,
  -- mas removemos explicitamente para deixar log claro.
  DELETE FROM public.audiencias_detectadas a
  WHERE a.publicacao_id IN (SELECT id FROM tmp_alvo_djen);

  DELETE FROM public.tarefas_publicacoes t
  WHERE t.publicacao_id IN (SELECT id FROM tmp_alvo_djen);

  -- Apaga as publicações alvo
  DELETE FROM public.publicacoes_djen pd
  WHERE pd.id IN (SELECT id FROM tmp_alvo_djen);

  DROP TABLE tmp_alvo_djen;
END $$;