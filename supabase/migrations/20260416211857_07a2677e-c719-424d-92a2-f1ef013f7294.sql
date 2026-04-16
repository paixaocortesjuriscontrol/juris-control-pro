-- Separar o termo "First Tecnologia / SANTANDER + COLIGADAS" em 1 termo por palavra-chave
DO $$
DECLARE
  v_origem_id uuid := '1a9deee4-5945-4c42-a829-bd8dce3115e2';
  v_origem RECORD;
  v_palavras text[];
  v_palavra text;
BEGIN
  SELECT * INTO v_origem FROM public.monitoramentos_djen WHERE id = v_origem_id;
  IF v_origem.id IS NULL THEN
    RAISE EXCEPTION 'Termo de origem não encontrado';
  END IF;

  -- Lista de palavras-chave: termo_busca original + cada item de termos_or
  v_palavras := ARRAY['First Tecnologia'] || COALESCE(v_origem.termos_or, ARRAY[]::text[]);

  FOREACH v_palavra IN ARRAY v_palavras LOOP
    v_palavra := btrim(v_palavra);
    CONTINUE WHEN v_palavra IS NULL OR v_palavra = '';

    INSERT INTO public.monitoramentos_djen (
      tipo, termo_busca, descricao, oab, uf, coordenacao_id, ativo,
      criado_por, exclusoes, condicao_concomitante, termos_or, tribunais
    ) VALUES (
      v_origem.tipo,
      v_palavra,
      'SANTANDER + ' || v_palavra || ' + COLIGADA',
      v_origem.oab,
      v_origem.uf,
      v_origem.coordenacao_id,
      v_origem.ativo,
      v_origem.criado_por,
      v_origem.exclusoes,
      v_origem.condicao_concomitante,
      NULL,
      v_origem.tribunais
    );
  END LOOP;

  -- Remove o termo agregado original
  DELETE FROM public.monitoramentos_djen WHERE id = v_origem_id;
END $$;