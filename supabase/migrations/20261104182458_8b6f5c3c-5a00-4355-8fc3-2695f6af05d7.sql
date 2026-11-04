ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS importado_djen_em timestamptz,
  ADD COLUMN IF NOT EXISTS ja_existia_antes_djen boolean;

INSERT INTO public.processo_tags_catalogo (nome, cor, ativo)
SELECT 'DJEN AUTOMÁTICO', '#0ea5e9', true
WHERE NOT EXISTS (SELECT 1 FROM public.processo_tags_catalogo WHERE upper(nome) = 'DJEN AUTOMÁTICO');

CREATE OR REPLACE FUNCTION public.gerar_distribuicoes_tst_auto(_dias integer DEFAULT 7)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record; txt text; dig text; num text; d date; bid uuid; n integer := 0; tag uuid;
  coord uuid := 'b0f690ad-68da-43d7-af5f-9adafeab3fd5';
BEGIN
  SELECT id INTO tag FROM processo_tags_catalogo WHERE upper(nome) = 'DJEN AUTOMÁTICO' LIMIT 1;
  FOR r IN
    SELECT p.processo_numero, p.conteudo, p.orgao, p.data_publicacao
    FROM publicacoes_djen p
    WHERE p.coordenacao_id = coord
      AND p.created_at > now() - make_interval(days => _dias)
      AND p.tipo_comunicacao ILIKE '%lista de distribui%'
    ORDER BY p.data_publicacao
  LOOP
    txt := regexp_replace(coalesce(r.conteudo,''), '<[^>]+>', ' ', 'g');
    -- mesma precedência do botão Docs TST: Temas IRR e CEJUSC (Zoom) vencem a distribuição
    IF txt ~* 'sobrest|suspens[aã]o\s+(d[oa]s?\s+)?(feito|processo|autos|recurso)' AND txt ~* '\mtema\s+(vinculante|n?[º°o]?\s*\d)|IncJulgRREmbRep' THEN CONTINUE; END IF;
    IF (coalesce(r.orgao,'') ~* '\mCEJUSC\M' OR txt ~* '\mCEJUSC\M') AND txt ~* 'plataforma\s+zoom' THEN CONTINUE; END IF;
    dig := regexp_replace(coalesce(r.processo_numero,''), '\D', '', 'g');
    IF length(dig) <> 20 THEN CONTINUE; END IF;
    num := substr(dig,1,7)||'-'||substr(dig,8,2)||'.'||substr(dig,10,4)||'.'||substr(dig,14,1)||'.'||substr(dig,15,2)||'.'||substr(dig,17);
    d := (r.data_publicacao AT TIME ZONE 'America/Sao_Paulo')::date;

    SELECT id INTO bid FROM dados_benner WHERE processo = num ORDER BY created_at LIMIT 1;
    IF bid IS NULL THEN
      INSERT INTO dados_benner (processo, aba_origem, data_distribuicao_real, fontes_importacao, importado_djen_em, ja_existia_antes_djen)
      VALUES (num, 'DJEN automático', d, ARRAY['DJEN automático'], now(), false)
      RETURNING id INTO bid;
      n := n + 1;
    ELSE
      UPDATE dados_benner SET
        data_distribuicao_real = coalesce(data_distribuicao_real, d),
        fontes_importacao = CASE WHEN 'DJEN automático' = ANY(coalesce(fontes_importacao,'{}')) THEN fontes_importacao
                                 ELSE array_append(coalesce(fontes_importacao,'{}'), 'DJEN automático') END,
        ja_existia_antes_djen = coalesce(ja_existia_antes_djen, importado_djen_em IS NULL),
        importado_djen_em = coalesce(importado_djen_em, now())
      WHERE id = bid AND importado_djen_em IS NULL;
      IF FOUND THEN n := n + 1; END IF;
    END IF;
    IF tag IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dados_benner_processo_tags WHERE dado_benner_id = bid AND tag_id = tag) THEN
      INSERT INTO dados_benner_processo_tags (dado_benner_id, tag_id) VALUES (bid, tag);
    END IF;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.gerar_distribuicoes_tst_auto(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_distribuicoes_tst_auto(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.buscar_distribuicoes_tst_agora(_dias integer DEFAULT 7)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM membros_coordenacao WHERE user_id = auth.uid() AND coordenacao_id = 'b0f690ad-68da-43d7-af5f-9adafeab3fd5')) THEN
    RAISE EXCEPTION 'sem acesso';
  END IF;
  RETURN public.gerar_distribuicoes_tst_auto(least(greatest(coalesce(_dias,7),1),
    CASE WHEN has_role(auth.uid(),'admin') THEN 180 ELSE 31 END));
END $$;
REVOKE EXECUTE ON FUNCTION public.buscar_distribuicoes_tst_agora(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.buscar_distribuicoes_tst_agora(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_pautas_apos_djen_servidor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tipo = 'djen_paralela_servidor' AND NEW.status IN ('concluido','concluido_parcial')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    BEGIN PERFORM public.gerar_pautas_tst_auto(2);
    EXCEPTION WHEN others THEN RAISE WARNING 'gerar_pautas_tst_auto: %', SQLERRM; END;
    BEGIN PERFORM public.gerar_distribuicoes_tst_auto(7);
    EXCEPTION WHEN others THEN RAISE WARNING 'gerar_distribuicoes_tst_auto: %', SQLERRM; END;
  END IF;
  RETURN NEW;
END $$;