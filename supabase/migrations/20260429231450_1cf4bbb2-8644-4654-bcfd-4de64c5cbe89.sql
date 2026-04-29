DO $$
DECLARE
  v_coord_id uuid;
  v_total int;
BEGIN
  SELECT id INTO v_coord_id FROM public.coordenacoes WHERE nome ILIKE '%Renata%' LIMIT 1;
  IF v_coord_id IS NULL THEN
    RAISE EXCEPTION 'Coordenação Renata não encontrada';
  END IF;

  CREATE TEMP TABLE _alvo ON COMMIT DROP AS
  SELECT id, hash_conteudo
  FROM public.publicacoes_djen
  WHERE coordenacao_id = v_coord_id
    AND created_at >= '2026-04-29 03:00:00Z'
    AND created_at <= '2026-04-30 02:59:59.999Z';

  SELECT COUNT(*) INTO v_total FROM _alvo;
  RAISE NOTICE 'Total a apagar: %', v_total;

  DELETE FROM public.publicacoes_djen_leituras l USING _alvo a WHERE l.publicacao_id = a.id;
  DELETE FROM public.publicacoes_djen_global_hash gh USING _alvo a 
    WHERE gh.publicacao_id = a.id OR gh.hash_global = a.hash_conteudo;
  DELETE FROM public.audiencias_detectadas ad USING _alvo a WHERE ad.publicacao_id = a.id;
  DELETE FROM public.tarefas_publicacoes tp USING _alvo a WHERE tp.publicacao_id = a.id;
  DELETE FROM public.publicacoes_djen pd USING _alvo a WHERE pd.id = a.id;
END $$;