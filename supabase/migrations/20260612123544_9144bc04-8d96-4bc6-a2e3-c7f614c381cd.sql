ALTER TABLE public.dados_benner ADD COLUMN IF NOT EXISTS recurso_terceiro boolean DEFAULT false;
ALTER TABLE public.dados_benner ADD COLUMN IF NOT EXISTS cejusc boolean DEFAULT false;

DROP FUNCTION IF EXISTS public.get_distribuicao_tst_stats(jsonb);

CREATE OR REPLACE FUNCTION public.get_distribuicao_tst_stats(filters jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(total bigint, processos_unicos bigint, processos_validos bigint, processos_invalidos bigint, dossies_validos bigint, dossies_invalidos bigint, dossies_nao_preenchidos bigint, judit_preenchido bigint, judit_nao_preenchido bigint, benner_sim bigint, benner_nao bigint, processos_ativos bigint, transito_julgado bigint, outros_situacao bigint, sem_turma bigint, problema_judit bigint, ate_2025 bigint, de_2026 bigint, pronto_envio bigint, sem_responsavel bigint, com_equipe bigint, sem_equipe bigint, a_fazer bigint)
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
  v_situacao text           := NULLIF(filters->>'situacaoProcesso', '');
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

  IF v_mes_ano IS NOT NULL AND v_mes_ano <> 'todos' THEN
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
      db.turma,
      db.problema_judit,
      db.data_distribuicao_planilha,
      db.status,
      db.equipe
    FROM public.dados_benner db
    WHERE db.aba_origem IS NOT NULL
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
        v_situacao IS NULL OR v_situacao = 'todos'
        OR (v_situacao = 'ativo' AND lower(db.situacao_processo) = 'ativo' AND db.transito_julgado IS DISTINCT FROM true)
        OR (v_situacao = 'transito' AND db.transito_julgado = true)
        OR (v_situacao = 'outros' AND (
              db.situacao_processo IS NULL
              OR lower(db.situacao_processo) <> 'ativo'
            )
            AND db.transito_julgado IS DISTINCT FROM true
        )
        OR (v_situacao = 'outro_escritorio' AND db.processo_outro_escritorio = true)
        OR (v_situacao = 'segredo_justica' AND db.segredo_justica = true)
        OR (v_situacao = 'a_fazer'
            AND db.transito_julgado IS DISTINCT FROM true
            AND db.processo_outro_escritorio IS DISTINCT FROM true
            AND db.segredo_justica IS DISTINCT FROM true
            AND (db.status IS NULL OR db.status::text <> 'pronto_envio')
        )
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
      AND (v_mes_start IS NULL OR (db.data_distribuicao_planilha >= v_mes_start AND db.data_distribuicao_planilha < v_mes_end))
      AND (v_data_inicio IS NULL OR db.data_distribuicao_planilha >= v_data_inicio::date)
      AND (v_data_fim    IS NULL OR db.data_distribuicao_planilha <= v_data_fim::date)
      AND (NOT v_sem_turma OR (db.turma IS NULL OR db.turma = ''))
      AND (v_status IS NULL OR v_status = 'todos' OR db.status::text = v_status)
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
    COUNT(*) FILTER (WHERE b.data_distribuicao_planilha IS NOT NULL AND b.data_distribuicao_planilha <= '2025-12-31'::date)::bigint,
    COUNT(*) FILTER (WHERE b.data_distribuicao_planilha IS NOT NULL AND b.data_distribuicao_planilha >= '2026-01-01'::date)::bigint,
    COUNT(*) FILTER (WHERE b.status::text = 'pronto_envio')::bigint,
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
        AND (b.status IS NULL OR b.status::text <> 'pronto_envio')
    )::bigint
  FROM base b;
END;
$function$;