DROP FUNCTION IF EXISTS public.get_distribuicao_tst_stats(jsonb);
CREATE FUNCTION public.get_distribuicao_tst_stats(filters jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(total bigint, processos_unicos bigint, processos_validos bigint, processos_invalidos bigint, dossies_validos bigint, dossies_invalidos bigint, dossies_nao_preenchidos bigint, judit_preenchido bigint, judit_nao_preenchido bigint, benner_sim bigint, benner_nao bigint, processos_ativos bigint, transito_julgado bigint, outros_situacao bigint, sem_turma bigint, problema_judit bigint, ate_2025 bigint, de_2026 bigint, pronto_envio bigint, sem_responsavel bigint, com_equipe bigint, sem_equipe bigint, a_fazer bigint, nao_precisa_fazer bigint, pronto_envio_puro bigint, planilhado bigint, enviado bigint, com_materia_dossie bigint, sem_materia_dossie bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_aba_origem text         := NULLIF(filters->>'aba_origem', '');
  v_centralizador text      := NULLIF(filters->>'centralizador', '');
  v_benner text             := NULLIF(filters->>'benner', '');
  v_dossie_status text      := NULLIF(filters->>'dossieStatus', '');
  v_processo_status text    := NULLIF(filters->>'processoStatus', '');
  v_judit text              := NULLIF(filters->>'judit', '');
  v_situacao text := NULLIF(filters->>'situacaoProcesso', '');
  v_situacoes text[] := CASE WHEN jsonb_typeof(filters->'situacaoProcesso') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(filters->'situacaoProcesso')) WHEN public.jsonb_text_array(filters->'situacaoProcesso') IS NULL THEN NULL ELSE ARRAY[filters->>'situacaoProcesso'] END;
  v_subida text             := NULLIF(filters->>'subidaMassa', '');
  v_processo text           := NULLIF(filters->>'processo', '');
  v_dossie text             := NULLIF(filters->>'dossie', '');
  v_turma text              := NULLIF(filters->>'turma', '');
  v_relator text            := NULLIF(filters->>'relator', '');
  v_parte text              := NULLIF(filters->>'parte', '');
  v_nome_parte text         := NULLIF(filters->>'nomeParte', '');
  v_mes_ano text            := NULLIF(filters->>'mesAno', '');
  v_data_inicio text        := NULLIF(filters->>'dataInicio', '');
  v_data_fim text           := NULLIF(filters->>'dataFim', '');
  v_status text             := NULLIF(filters->>'status', '');
  v_problema_judit text     := NULLIF(filters->>'problemaJudit', '');
  v_duplicado text          := NULLIF(filters->>'duplicado', '');
  v_fonte_importacao text   := NULLIF(filters->>'fonteImportacao', '');
  v_provas text             := NULLIF(filters->>'provasDigitais', '');
  v_equipe text             := NULLIF(filters->>'equipe', '');
  v_sem_turma boolean       := COALESCE((filters->>'semTurma')::boolean, false);
  v_situacao_envio text     := NULLIF(filters->>'situacaoEnvioCargaId', '');
  v_situacao_envio_uuid uuid := NULL;
  v_resp_ids uuid[]         := NULL;
  v_wants_unassigned boolean := false;
  v_mes_start date;
  v_mes_end date;
  v_cnj_re text := '^[0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4}$';
  v_dossie_re text := '^[0-9]{2}\.[0-9]{2}\.[0-9]{3}\.[0-9]{7,}/[0-9]{2}$';
  v_parte_rec text          := NULLIF(filters->>'parteRecorrente', '');
  v_erro_judit text         := NULLIF(filters->>'erroJudit', '');
  v_em_analise text         := NULLIF(filters->>'emAnalise', '');
  v_acordo text             := NULLIF(filters->>'acordo', '');
  v_ids_allowed uuid[]      := NULL;
  v_has_ids_allowed boolean := false;
BEGIN
  IF jsonb_typeof(filters->'responsavelIds') = 'array' THEN
    SELECT array_agg(elem::uuid) INTO v_resp_ids
    FROM jsonb_array_elements_text(filters->'responsavelIds') AS elem
    WHERE elem <> '__sem_responsavel__';
    v_wants_unassigned := EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(filters->'responsavelIds') AS elem
      WHERE elem = '__sem_responsavel__'
    );
  END IF;

  IF jsonb_typeof(filters->'idsAllowed') = 'array' THEN
    v_has_ids_allowed := true;
    SELECT array_agg(elem::uuid) INTO v_ids_allowed
    FROM jsonb_array_elements_text(filters->'idsAllowed') AS elem;
    IF v_ids_allowed IS NULL THEN v_ids_allowed := ARRAY[]::uuid[]; END IF;
  END IF;

  IF v_mes_ano IS NOT NULL AND v_mes_ano <> 'todos' AND v_mes_ano <> 'sem-data' THEN
    v_mes_start := (v_mes_ano || '-01')::date;
    v_mes_end   := (v_mes_start + INTERVAL '1 month')::date;
  END IF;

  IF v_situacao_envio IS NOT NULL AND v_situacao_envio <> 'todas' AND v_situacao_envio <> '__sem__' THEN
    BEGIN
      v_situacao_envio_uuid := v_situacao_envio::uuid;
    EXCEPTION WHEN others THEN
      v_situacao_envio_uuid := NULL;
    END;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      db.id,
      db.processo,
      db.dossie,
      db.judit_preenchido,
      db.benner_atualizado,
      db.situacao_processo,
      db.transito_julgado,
      db.processo_outro_escritorio,
      db.segredo_justica,
      db.cejusc,
      db.turma,
      db.problema_judit,
      db.data_distribuicao_real,
      db.data_distribuicao_planilha,
      db.status,
      db.equipe,
      db.tem_materias_dossie
    FROM public.dados_benner db
    WHERE db.aba_origem IS NOT NULL
      AND (
        NULLIF(filters->>'semPendencia','') IS NULL OR filters->>'semPendencia' = 'todos'
        OR (filters->>'semPendencia' = 'sem' AND db.sem_pendencia IS TRUE)
        OR (filters->>'semPendencia' = 'com' AND db.status IN ('pronto_envio','planilhado','enviado') AND db.sem_pendencia IS DISTINCT FROM true)
      )
      AND (
        NULLIF(filters->>'revisarListaMaterias','') IS NULL OR filters->>'revisarListaMaterias' = 'todos'
        OR (filters->>'revisarListaMaterias' = 'sim' AND db.revisar_lista_materias IS TRUE)
      )
      AND (NOT (COALESCE(filters->'excluirSituacoes', '[]'::jsonb) ? 'cejusc') OR db.cejusc IS DISTINCT FROM true)
      AND (NOT (COALESCE(filters->'excluirSituacoes', '[]'::jsonb) ? 'acordo') OR db.acordo IS DISTINCT FROM true)
      AND (NOT (COALESCE(filters->'excluirSituacoes', '[]'::jsonb) ? 'segredo_justica') OR db.segredo_justica IS DISTINCT FROM true)
      AND (NOT (COALESCE(filters->'excluirSituacoes', '[]'::jsonb) ? 'outro_escritorio') OR db.processo_outro_escritorio IS DISTINCT FROM true)
      AND (NOT (COALESCE(filters->'excluirSituacoes', '[]'::jsonb) ? 'transito') OR db.transito_julgado IS DISTINCT FROM true) AND (
        public.jsonb_text_array(filters->'tagId') IS NULL
        OR 'todas' = ANY(public.jsonb_text_array(filters->'tagId'))
        OR (jsonb_typeof(filters->'tagId') = 'array' AND EXISTS (
              SELECT 1 FROM public.dados_benner_processo_tags t
              WHERE t.dado_benner_id = db.id
                AND t.tag_id::text = ANY(public.jsonb_text_array(filters->'tagId'))))
        OR (filters->>'tagId' = '__sem__' AND NOT EXISTS (
              SELECT 1 FROM public.dados_benner_processo_tags t
              WHERE t.dado_benner_id = db.id))
        OR (public.try_uuid(filters->>'tagId') IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.dados_benner_processo_tags t
              WHERE t.dado_benner_id = db.id
                AND t.tag_id = public.try_uuid(filters->>'tagId')))
      )
      AND (v_aba_origem IS NULL OR v_aba_origem = 'todas' OR db.aba_origem = v_aba_origem)
      AND (
        v_centralizador IS NULL OR v_centralizador = 'todos'
        OR (v_centralizador = '__sem__' AND (db.centralizador IS NULL OR db.centralizador = ''))
        OR (v_centralizador <> '__sem__' AND db.centralizador = v_centralizador)
      )
      AND (
        v_benner IS NULL OR v_benner = 'todos'
        OR (v_benner = 'sim' AND db.benner_atualizado = true)
        OR (v_benner = 'nao' AND (db.benner_atualizado IS NULL OR db.benner_atualizado = false))
      )
      AND (
        v_dossie_status IS NULL OR v_dossie_status = 'todos'
        OR (v_dossie_status = 'preenchido' AND db.dossie IS NOT NULL AND db.dossie <> '')
        OR (v_dossie_status = 'nao_preenchido' AND (db.dossie IS NULL OR db.dossie = ''))
        OR (v_dossie_status = 'valido' AND db.dossie ~ v_dossie_re)
        OR (v_dossie_status = 'invalido' AND db.dossie IS NOT NULL AND db.dossie <> '' AND db.dossie !~ v_dossie_re)
        OR (v_dossie_status = 'invalido_ou_nao_preenchido' AND (db.dossie IS NULL OR db.dossie = '' OR db.dossie !~ v_dossie_re))
      )
      AND (
        v_processo_status IS NULL OR v_processo_status = 'todos'
        OR (v_processo_status = 'valido' AND db.processo ~ v_cnj_re)
        OR (v_processo_status = 'invalido' AND (db.processo IS NULL OR db.processo = '' OR db.processo !~ v_cnj_re))
      )
      AND (
        v_judit IS NULL OR v_judit = 'todos'
        OR (v_judit = 'sim' AND db.judit_preenchido = true)
        OR (v_judit = 'nao' AND (db.judit_preenchido IS NULL OR db.judit_preenchido = false))
      )
      AND (
        v_situacoes IS NULL OR 'todos' = ANY(v_situacoes)
        OR ('pronto_enviar' = ANY(v_situacoes) AND db.status::text IN ('pronto_envio','planilhado','enviado'))
        OR ('problema_judit' = ANY(v_situacoes) AND db.problema_judit = true)
        OR ('recurso_terceiro' = ANY(v_situacoes) AND db.recurso_terceiro = true)
        OR ('acordo' = ANY(v_situacoes) AND db.acordo = true)
        OR ('ativo' = ANY(v_situacoes) AND lower(db.situacao_processo) = 'ativo' AND db.transito_julgado IS DISTINCT FROM true)
        OR ('transito' = ANY(v_situacoes) AND db.transito_julgado = true)
        OR ('outros' = ANY(v_situacoes) AND (
              db.situacao_processo IS NULL
              OR lower(db.situacao_processo) <> 'ativo'
            )
            AND db.transito_julgado IS DISTINCT FROM true
        )
        OR ('outro_escritorio' = ANY(v_situacoes) AND db.processo_outro_escritorio = true)
        OR ('segredo_justica' = ANY(v_situacoes) AND db.segredo_justica = true)
        OR ('cejusc' = ANY(v_situacoes) AND db.cejusc = true)
        OR ('a_fazer' = ANY(v_situacoes)
            AND db.cejusc IS DISTINCT FROM true
            AND db.transito_julgado IS DISTINCT FROM true
            AND db.processo_outro_escritorio IS DISTINCT FROM true
            AND db.segredo_justica IS DISTINCT FROM true
            AND (db.status IS NULL OR db.status::text NOT IN ('pronto_envio','planilhado','enviado'))
        )
        OR ('nao_precisa_fazer' = ANY(v_situacoes)
            AND (db.transito_julgado = true
                 OR db.processo_outro_escritorio = true
                 OR db.segredo_justica = true
                 OR db.cejusc = true)
        )
      )
      AND (
        NULLIF(filters->>'pedidosDossie','') IS NULL OR filters->>'pedidosDossie' = 'todos'
        OR (filters->>'pedidosDossie' = 'com' AND db.dossie IS NOT NULL AND db.dossie <> '' AND db.tem_materias_dossie)
        OR (filters->>'pedidosDossie' = 'sem' AND (db.dossie IS NULL OR db.dossie = '' OR NOT db.tem_materias_dossie))
      )
      AND (
        v_subida IS NULL OR v_subida = 'todos'
        OR (v_subida = 'sim' AND db.subida_em_massa = true)
        OR (v_subida = 'nao' AND (db.subida_em_massa IS NULL OR db.subida_em_massa = false))
      )
      AND (v_processo IS NULL OR db.processo ILIKE '%' || v_processo || '%')
      AND (v_dossie IS NULL OR db.dossie ILIKE '%' || v_dossie || '%')
      AND (v_turma IS NULL OR db.turma ILIKE '%' || v_turma || '%')
      AND (v_relator IS NULL OR db.relator ILIKE '%' || v_relator || '%')
      AND (v_parte IS NULL OR db.recorrente ILIKE '%' || v_parte || '%')
      AND (
        v_nome_parte IS NULL
        OR db.reclamante ILIKE '%' || regexp_replace(v_nome_parte, '[,()]', ' ', 'g') || '%'
        OR db.reclamada  ILIKE '%' || regexp_replace(v_nome_parte, '[,()]', ' ', 'g') || '%'
      )
      AND (
        v_mes_ano IS NULL OR v_mes_ano = 'todos'
        OR (v_mes_ano = 'sem-data' AND COALESCE(db.data_distribuicao_real, db.data_distribuicao_planilha) IS NULL)
        OR (v_mes_ano <> 'sem-data' AND COALESCE(db.data_distribuicao_real, db.data_distribuicao_planilha) >= v_mes_start AND COALESCE(db.data_distribuicao_real, db.data_distribuicao_planilha) < v_mes_end)
      )
      AND (v_data_inicio IS NULL OR COALESCE(db.data_distribuicao_real, db.data_distribuicao_planilha) >= v_data_inicio::date)
      AND (v_data_fim    IS NULL OR COALESCE(db.data_distribuicao_real, db.data_distribuicao_planilha) <= v_data_fim::date)
      AND (NOT v_sem_turma OR (db.turma IS NULL OR db.turma = ''))
      AND (v_status IS NULL OR v_status = 'todos' OR (v_status = 'concluidos' AND db.status::text IN ('pronto_envio','planilhado','enviado')) OR (v_status <> 'concluidos' AND db.status::text = v_status))
      AND (
        v_problema_judit IS NULL OR v_problema_judit = 'todos'
        OR (v_problema_judit = 'sim' AND db.problema_judit = true)
        OR (v_problema_judit = 'nao' AND (db.problema_judit IS NULL OR db.problema_judit = false))
      )
      AND (
        v_duplicado IS NULL OR v_duplicado = 'todos'
        OR (v_duplicado = 'sim' AND db.ic_duplicado = true)
        OR (v_duplicado = 'nao' AND (db.ic_duplicado IS NULL OR db.ic_duplicado = false))
      )
      AND (
        v_fonte_importacao IS NULL OR v_fonte_importacao = 'todas'
        OR db.fontes_importacao @> ARRAY[v_fonte_importacao]
      )
      AND (
        v_provas IS NULL OR v_provas = 'todos'
        OR (v_provas = 'sim' AND lower(db.provas_digitais) = 's')
        OR (v_provas = 'nao' AND lower(db.provas_digitais) = 'n')
        OR (v_provas = 'nao_selecionado' AND (db.provas_digitais IS NULL OR db.provas_digitais = ''))
      )
      AND (
        v_situacao_envio IS NULL OR v_situacao_envio = 'todas'
        OR (v_situacao_envio = '__sem__' AND db.situacao_envio_carga_id IS NULL)
        OR (v_situacao_envio_uuid IS NOT NULL AND db.situacao_envio_carga_id = v_situacao_envio_uuid)
      )
      AND (
        v_equipe IS NULL OR v_equipe = 'todos'
        OR (v_equipe = 'sim' AND db.equipe IS NOT NULL AND btrim(db.equipe) <> '')
        OR (v_equipe = 'nao' AND (db.equipe IS NULL OR btrim(db.equipe) = ''))
      )
      AND (
        v_erro_judit IS NULL OR v_erro_judit = 'todos'
        OR (v_erro_judit = 'sim' AND db.erro_judit = true)
        OR (v_erro_judit = 'nao' AND (db.erro_judit IS NULL OR db.erro_judit = false))
      )
      AND (
        v_em_analise IS NULL OR v_em_analise = 'todos'
        OR (v_em_analise = 'sim' AND db.em_analise = true)
        OR (v_em_analise = 'nao'
            AND (db.em_analise IS NULL OR db.em_analise = false)
            AND (db.analisado IS NULL OR db.analisado = false))
        OR (v_em_analise = 'analisado' AND db.analisado = true)
      )
      AND (
        v_acordo IS NULL OR v_acordo = 'todos'
        OR (v_acordo = 'sim' AND db.acordo = true)
        OR (v_acordo = 'nao' AND (db.acordo IS NULL OR db.acordo = false))
      )
      AND (
        v_parte_rec IS NULL OR
        CASE v_parte_rec
          WHEN 'Reclamante' THEN
            db.recorrente ILIKE '%reclamante%'
            AND db.recorrente NOT ILIKE '%reclamad%'
            AND db.recorrente NOT ILIKE '%banco%'
            AND db.recorrente NOT ILIKE '%terceiro%'
            AND db.recorrente NOT ILIKE '%ambos%'
          WHEN 'Reclamado' THEN
            (db.recorrente ILIKE '%reclamad%' OR db.recorrente ILIKE '%banco%')
            AND db.recorrente NOT ILIKE '%reclamante%'
            AND db.recorrente NOT ILIKE '%terceiro%'
            AND db.recorrente NOT ILIKE '%ambos%'
          WHEN 'Reclamante e Reclamado' THEN
            ((db.recorrente ILIKE '%reclamante%'
              AND (db.recorrente ILIKE '%reclamad%' OR db.recorrente ILIKE '%banco%'))
             OR db.recorrente ILIKE '%ambos%')
            AND db.recorrente NOT ILIKE '%terceiro%'
          WHEN 'Terceiro' THEN
            db.recorrente ILIKE '%terceiro%'
            AND db.recorrente NOT ILIKE '%reclamante%'
            AND db.recorrente NOT ILIKE '%reclamad%'
            AND db.recorrente NOT ILIKE '%banco%'
            AND db.recorrente NOT ILIKE '%ambos%'
          WHEN 'Reclamante e Terceiro' THEN
            db.recorrente ILIKE '%reclamante%'
            AND db.recorrente ILIKE '%terceiro%'
            AND db.recorrente NOT ILIKE '%reclamad%'
            AND db.recorrente NOT ILIKE '%banco%'
          WHEN 'Reclamado e Terceiro' THEN
            (db.recorrente ILIKE '%reclamad%' OR db.recorrente ILIKE '%banco%')
            AND db.recorrente ILIKE '%terceiro%'
            AND db.recorrente NOT ILIKE '%reclamante%'
          WHEN 'Reclamante, Reclamado e Terceiro' THEN
            db.recorrente ILIKE '%reclamante%'
            AND (db.recorrente ILIKE '%reclamad%' OR db.recorrente ILIKE '%banco%')
            AND db.recorrente ILIKE '%terceiro%'
          ELSE db.recorrente ILIKE '%' || v_parte_rec || '%'
        END
      )
      AND (
        NOT v_has_ids_allowed
        OR db.id = ANY(v_ids_allowed)
      )
      AND (
        v_resp_ids IS NULL
        OR EXISTS (
          SELECT 1 FROM public.dados_benner_responsaveis r
          WHERE r.dados_benner_id = db.id AND r.usuario_id = ANY(v_resp_ids)
        )
      )
      AND (
        NOT v_wants_unassigned
        OR NOT EXISTS (
          SELECT 1 FROM public.dados_benner_responsaveis r
          WHERE r.dados_benner_id = db.id
        )
      )
  )
  SELECT
    COUNT(*)::bigint,
    COUNT(DISTINCT lower(btrim(b.processo))) FILTER (WHERE b.processo IS NOT NULL AND btrim(b.processo) <> '')::bigint,
    COUNT(*) FILTER (WHERE b.processo ~ v_cnj_re)::bigint,
    COUNT(*) FILTER (WHERE b.processo IS NULL OR b.processo = '' OR b.processo !~ v_cnj_re)::bigint,
    COUNT(*) FILTER (WHERE b.dossie ~ v_dossie_re)::bigint,
    COUNT(*) FILTER (WHERE b.dossie IS NOT NULL AND b.dossie <> '' AND b.dossie !~ v_dossie_re)::bigint,
    COUNT(*) FILTER (WHERE b.dossie IS NULL OR b.dossie = '')::bigint,
    COUNT(*) FILTER (WHERE b.judit_preenchido = true)::bigint,
    COUNT(*) FILTER (WHERE b.judit_preenchido IS NULL OR b.judit_preenchido = false)::bigint,
    COUNT(*) FILTER (WHERE b.benner_atualizado = true)::bigint,
    COUNT(*) FILTER (WHERE b.benner_atualizado IS NULL OR b.benner_atualizado = false)::bigint,
    COUNT(*) FILTER (
      WHERE b.transito_julgado IS DISTINCT FROM true
        AND lower(b.situacao_processo) = 'ativo'
    )::bigint,
    COUNT(*) FILTER (WHERE b.transito_julgado = true)::bigint,
    COUNT(*) FILTER (
      WHERE b.transito_julgado IS DISTINCT FROM true
        AND (lower(b.situacao_processo) IS DISTINCT FROM 'ativo')
    )::bigint,
    COUNT(*) FILTER (WHERE b.turma IS NULL OR b.turma = '')::bigint,
    COUNT(*) FILTER (WHERE b.problema_judit = true)::bigint,
    COUNT(*) FILTER (WHERE COALESCE(b.data_distribuicao_real, b.data_distribuicao_planilha) IS NOT NULL AND COALESCE(b.data_distribuicao_real, b.data_distribuicao_planilha) <= '2025-12-31'::date)::bigint,
    COUNT(*) FILTER (WHERE COALESCE(b.data_distribuicao_real, b.data_distribuicao_planilha) IS NOT NULL AND COALESCE(b.data_distribuicao_real, b.data_distribuicao_planilha) >= '2026-01-01'::date)::bigint,
    COUNT(*) FILTER (WHERE b.status::text IN ('pronto_envio','planilhado','enviado'))::bigint,
    COUNT(*) FILTER (
      WHERE NOT EXISTS (
        SELECT 1 FROM public.dados_benner_responsaveis r WHERE r.dados_benner_id = b.id
      )
    )::bigint,
    COUNT(*) FILTER (WHERE b.equipe IS NOT NULL AND btrim(b.equipe) <> '')::bigint,
    COUNT(*) FILTER (WHERE b.equipe IS NULL OR btrim(b.equipe) = '')::bigint,
    COUNT(*) FILTER (
      WHERE b.transito_julgado IS DISTINCT FROM true
        AND b.processo_outro_escritorio IS DISTINCT FROM true
        AND b.segredo_justica IS DISTINCT FROM true
        AND b.cejusc IS DISTINCT FROM true
        AND (b.status IS NULL OR b.status::text NOT IN ('pronto_envio','planilhado','enviado'))
    )::bigint,
    COUNT(*) FILTER (
      WHERE b.transito_julgado = true
         OR b.processo_outro_escritorio = true
         OR b.segredo_justica = true
         OR b.cejusc = true
    )::bigint
,
    COUNT(*) FILTER (WHERE b.status::text = 'pronto_envio')::bigint,
    COUNT(*) FILTER (WHERE b.status::text = 'planilhado')::bigint,
    COUNT(*) FILTER (WHERE b.status::text = 'enviado')::bigint,
    COUNT(*) FILTER (WHERE b.dossie IS NOT NULL AND b.dossie <> '' AND b.tem_materias_dossie IS TRUE)::bigint,
    COUNT(*) FILTER (WHERE b.dossie IS NULL OR b.dossie = '' OR b.tem_materias_dossie IS NOT TRUE)::bigint
  FROM base b;
END;
$function$