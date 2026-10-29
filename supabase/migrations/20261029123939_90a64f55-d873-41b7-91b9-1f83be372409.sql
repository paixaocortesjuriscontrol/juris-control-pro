-- ============================================================================
-- Agenda do Painel de Controle: buscas prontas por tipo.
--   get_agenda_pessoal   -> escopo da pessoa (responsável/co-responsável/
--                           envolvida/criadora, participante de evento,
--                           advogada ou envolvida em audiência)
--   get_agenda_escritorio-> escopo das coordenações (tudo do mês, sem olhar
--                           responsável nem envolvido)
-- Ambas SECURITY INVOKER: a regra de acesso de cada linha continua valendo.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_agenda_pessoal(
  p_usuario uuid,
  p_inicio date,
  p_fim date,
  p_inicio_ts timestamptz DEFAULT NULL,
  p_fim_ts timestamptz DEFAULT NULL,
  p_fontes text[] DEFAULT NULL,
  p_tipos text[] DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_status_in text[] DEFAULT NULL,
  p_status_not_in text[] DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 1000
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $fn$
DECLARE
  v_fontes text[] := NULLIF(array_remove(p_fontes, NULL::text), '{}');
  v_ui text[] := NULLIF(array_remove(p_tipos, NULL::text), '{}');
  v_task_tipos text[];
  v_event_tipos text[];
  v_ini date := p_inicio;
  v_fim date := p_fim;
  v_ini_ts timestamptz := COALESCE(p_inicio_ts, p_inicio::timestamptz);
  v_fim_ts timestamptz := COALESCE(p_fim_ts, (p_fim + 1)::timestamptz - interval '1 microsecond');
  v_status text := NULLIF(p_status, '');
  v_sit_in text[] := NULLIF(coalesce(p_status_in, '{}'), '{}');
  v_sit_not text[] := NULLIF(coalesce(p_status_not_in, '{}'), '{}');
  v_lim integer := GREATEST(COALESCE(p_limit, 1000), 1);
  v_off integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_rows jsonb;
  v_out jsonb := '{}'::jsonb;
BEGIN
  IF v_fontes IS NULL THEN
    v_fontes := ARRAY['tarefas','eventos','prazos_tst','audiencias','parcelas'];
  END IF;

  IF v_ui IS NULL THEN
    v_task_tipos := ARRAY['tarefa','prazo','audiencia','evento','parcelamento'];
    v_event_tipos := ARRAY['evento','prazo','audiencia','parcelamento','prazo_parcela'];
  ELSE
    SELECT COALESCE(array_agg(DISTINCT CASE WHEN x = 'tarefa_delegada' THEN 'tarefa' ELSE x END)
                      FILTER (WHERE x IN ('tarefa','tarefa_delegada','prazo','audiencia','evento','parcelamento')), '{}')
      INTO v_task_tipos FROM unnest(v_ui) x;
    SELECT COALESCE(array_agg(DISTINCT x) FILTER (WHERE x IN ('evento','prazo','audiencia','parcelamento','prazo_parcela')), '{}')
      INTO v_event_tipos FROM unnest(v_ui) x;
  END IF;

  -- ============ TAREFAS (inclui Atas) ============
  IF 'tarefas' = ANY(v_fontes) THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.data_vencimento NULLS LAST, x.id), '[]'::jsonb)
      INTO v_rows
      FROM (
        SELECT
          t.id, t.titulo, t.descricao, t.data_vencimento, t.data_fatal, t.data_prevista,
          t.data_cumprimento, t.tipo_tarefa, t.status, t.prioridade, t.observacoes, t.origem,
          t.created_at, t.updated_at, t.processo_id, t.coordenacao_id, t.responsavel_id,
          t.criado_por, t.identificador_projuris, t.hora_fatal, t.hora_prevista, t.data_base,
          t.prazo_dias, t.prazo_unidade, t.link_local, t.orgao, t.partes_ativas, t.partes_passivas,
          t.recorrente, t.recorrencia_tipo, t.recorrencia_intervalo, t.recorrencia_fim,
          t.recorrencia_rrule,
          CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id', p.id, 'numero', p.numero,
               'assunto', p.assunto, 'cliente_id', p.cliente_id, 'coordenacao_id', p.coordenacao_id) END AS processo,
          CASE WHEN rp.id IS NULL THEN NULL ELSE jsonb_build_object('id', rp.id, 'nome', rp.nome) END AS responsavel,
          CASE WHEN rc.id IS NULL THEN NULL ELSE jsonb_build_object('id', rc.id, 'nome', rc.nome) END AS criador,
          jsonb_build_array(jsonb_build_object('count',
            (SELECT count(*) FROM documentos d WHERE d.tarefa_id = t.id))) AS documentos,
          COALESCE((SELECT jsonb_agg(tr.usuario_id) FROM tarefa_responsaveis tr
                     WHERE tr.tarefa_id = t.id), '[]'::jsonb) AS responsaveis,
          COALESCE((SELECT jsonb_agg(te.usuario_id) FROM tarefa_envolvidos te
                     WHERE te.tarefa_id = t.id), '[]'::jsonb) AS envolvidos
        FROM tarefas t
        LEFT JOIN processos p ON p.id = t.processo_id
        LEFT JOIN profiles_basic rp ON rp.id = t.responsavel_id
        LEFT JOIN profiles_basic rc ON rc.id = t.criado_por
        WHERE t.id IN (
          SELECT u.id FROM (
            (SELECT t2.id, t2.data_vencimento FROM tarefas t2
              WHERE t2.data_vencimento >= v_ini AND t2.data_vencimento <= v_fim
                AND (CASE upper(btrim(coalesce(t2.tipo_tarefa, '')))
                        WHEN 'AUDIÊNCIA' THEN 'audiencia' WHEN 'AUDIENCIA' THEN 'audiencia'
                        WHEN 'PRAZO' THEN 'prazo' WHEN 'EVENTO' THEN 'evento'
                        WHEN 'PARCELAMENTO' THEN 'parcelamento'
                        WHEN 'PARCELAMENTO_RECORRENTE' THEN 'parcelamento'
                        ELSE 'tarefa' END) = ANY(v_task_tipos)
                AND (t2.responsavel_id = p_usuario OR t2.criado_por = p_usuario
                     OR EXISTS (SELECT 1 FROM tarefa_responsaveis tr2
                                 WHERE tr2.tarefa_id = t2.id AND tr2.usuario_id = p_usuario)
                     OR EXISTS (SELECT 1 FROM tarefa_envolvidos te2
                                 WHERE te2.tarefa_id = t2.id AND te2.usuario_id = p_usuario))
                AND (v_status IS NULL
                     OR (v_status = 'pendente' AND t2.status = 'pendente')
                     OR (v_status = 'concluido' AND t2.status = 'cumprido'))
                AND (v_sit_in IS NULL OR t2.status::text = ANY(v_sit_in))
                AND (v_sit_not IS NULL OR t2.status::text <> ALL(v_sit_not)))
            UNION ALL
            (SELECT t3.id, t3.data_vencimento FROM tarefas t3
              WHERE t3.recorrencia_tipo IS NOT NULL AND t3.data_vencimento < v_ini
                AND (CASE upper(btrim(coalesce(t3.tipo_tarefa, '')))
                        WHEN 'AUDIÊNCIA' THEN 'audiencia' WHEN 'AUDIENCIA' THEN 'audiencia'
                        WHEN 'PRAZO' THEN 'prazo' WHEN 'EVENTO' THEN 'evento'
                        WHEN 'PARCELAMENTO' THEN 'parcelamento'
                        WHEN 'PARCELAMENTO_RECORRENTE' THEN 'parcelamento'
                        ELSE 'tarefa' END) = ANY(v_task_tipos)
                AND (t3.responsavel_id = p_usuario OR t3.criado_por = p_usuario
                     OR EXISTS (SELECT 1 FROM tarefa_responsaveis tr3
                                 WHERE tr3.tarefa_id = t3.id AND tr3.usuario_id = p_usuario)
                     OR EXISTS (SELECT 1 FROM tarefa_envolvidos te3
                                 WHERE te3.tarefa_id = t3.id AND te3.usuario_id = p_usuario))
                AND (v_status IS NULL
                     OR (v_status = 'pendente' AND t3.status = 'pendente')
                     OR (v_status = 'concluido' AND t3.status = 'cumprido'))
                AND (v_sit_in IS NULL OR t3.status::text = ANY(v_sit_in))
                AND (v_sit_not IS NULL OR t3.status::text <> ALL(v_sit_not)))
          ) u
          ORDER BY u.data_vencimento NULLS LAST, u.id
          LIMIT v_lim OFFSET v_off
        )
      ) x;
    v_out := v_out || jsonb_build_object('tarefas',
      jsonb_build_object('linhas', v_rows, 'tem_mais', jsonb_array_length(v_rows) >= v_lim));
  END IF;

  -- ============ EVENTOS ============
  IF 'eventos' = ANY(v_fontes) THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.data_inicio NULLS LAST, x.id), '[]'::jsonb)
      INTO v_rows
      FROM (
        SELECT e.*,
          CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id', p.id, 'numero', p.numero,
               'assunto', p.assunto, 'coordenacao_id', p.coordenacao_id) END AS processo,
          jsonb_build_array(jsonb_build_object('count',
            (SELECT count(*) FROM documentos d WHERE d.evento_id = e.id))) AS documentos,
          COALESCE((SELECT jsonb_agg(jsonb_build_object('evento_id', e.id, 'usuario_id', pe.usuario_id,
                          'usuario', CASE WHEN pp.id IS NULL THEN NULL
                                          ELSE jsonb_build_object('id', pp.id, 'nome', pp.nome) END))
                     FROM participantes_evento pe
                     LEFT JOIN profiles_basic pp ON pp.id = pe.usuario_id
                     WHERE pe.evento_id = e.id), '[]'::jsonb) AS participantes
        FROM eventos_agenda e
        LEFT JOIN processos p ON p.id = e.processo_id
        WHERE e.id IN (
          SELECT u.id FROM (
            (SELECT e2.id, e2.data_inicio FROM eventos_agenda e2
              WHERE e2.data_inicio >= v_ini_ts AND e2.data_inicio <= v_fim_ts
                AND coalesce(e2.tipo, '') = ANY(v_event_tipos)
                AND (e2.criado_por = p_usuario
                     OR EXISTS (SELECT 1 FROM participantes_evento pe2
                                 WHERE pe2.evento_id = e2.id AND pe2.usuario_id = p_usuario)))
            UNION ALL
            (SELECT e3.id, e3.data_inicio FROM eventos_agenda e3
              WHERE e3.data_inicio < v_ini_ts
                AND (e3.recorrente OR e3.recorrencia_tipo IS NOT NULL)
                AND coalesce(e3.tipo, '') = ANY(v_event_tipos)
                AND (e3.criado_por = p_usuario
                     OR EXISTS (SELECT 1 FROM participantes_evento pe3
                                 WHERE pe3.evento_id = e3.id AND pe3.usuario_id = p_usuario)))
            UNION ALL
            (SELECT e4.id, e4.data_inicio FROM eventos_agenda e4
              WHERE e4.data_inicio < v_ini_ts AND e4.data_fim >= v_ini_ts
                AND coalesce(e4.tipo, '') = ANY(v_event_tipos)
                AND (e4.criado_por = p_usuario
                     OR EXISTS (SELECT 1 FROM participantes_evento pe4
                                 WHERE pe4.evento_id = e4.id AND pe4.usuario_id = p_usuario)))
          ) u
          ORDER BY u.data_inicio NULLS LAST, u.id
          LIMIT v_lim OFFSET v_off
        )
      ) x;
    v_out := v_out || jsonb_build_object('eventos',
      jsonb_build_object('linhas', v_rows, 'tem_mais', jsonb_array_length(v_rows) >= v_lim));
  END IF;

  -- ============ PRAZOS FATAIS DO TST ============
  IF 'prazos_tst' = ANY(v_fontes) THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.data_fatal NULLS LAST, x.id), '[]'::jsonb)
      INTO v_rows
      FROM (
        SELECT pr.id, pr.numero, pr.polo_ativo, pr.polo_passivo, pr.data_fatal, pr.coordenacao_id,
               pr.criado_por_tst, pr.responsavel_tst_id, pr.responsavel_tst, pr.equipe_tst,
               pr.decisao_tst, pr.status, pr.prazo_fatal_conferido,
               CASE WHEN rp.id IS NULL THEN NULL ELSE jsonb_build_object('id', rp.id, 'nome', rp.nome) END AS responsavel,
               CASE WHEN rc.id IS NULL THEN NULL ELSE jsonb_build_object('id', rc.id, 'nome', rc.nome) END AS criador
        FROM processos pr
        LEFT JOIN profiles_basic rp ON rp.id = pr.responsavel_tst_id
        LEFT JOIN profiles_basic rc ON rc.id = pr.criado_por_tst
        WHERE pr.data_fatal IS NOT NULL
          AND pr.data_fatal >= v_ini AND pr.data_fatal <= v_fim
          AND (pr.criado_por_tst = p_usuario OR pr.responsavel_tst_id = p_usuario)
        ORDER BY pr.data_fatal NULLS LAST, pr.id
        LIMIT v_lim OFFSET v_off
      ) x;
    v_out := v_out || jsonb_build_object('prazos_tst',
      jsonb_build_object('linhas', v_rows, 'tem_mais', jsonb_array_length(v_rows) >= v_lim));
  END IF;

  -- ============ AUDIÊNCIAS DETECTADAS ============
  IF 'audiencias' = ANY(v_fontes) THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.data_audiencia NULLS LAST, x.id), '[]'::jsonb)
      INTO v_rows
      FROM (
        SELECT a.id, a.titulo, a.tipo_audiencia, a.processo_id, a.processo_numero, a.data_audiencia,
               a.hora, a.hora_fim, a.status, a.observacoes, a.local_audiencia, a.forum, a.sala_forum,
               a.modalidade, a.criado_por, a.coordenacao_id, a.created_at, a.updated_at,
               jsonb_build_array(jsonb_build_object('count',
                 (SELECT count(*) FROM documentos d WHERE d.audiencia_id = a.id))) AS documentos
        FROM audiencias_detectadas a
        WHERE a.data_audiencia IS NOT NULL
          AND a.data_audiencia >= v_ini_ts AND a.data_audiencia <= v_fim_ts
          AND (v_sit_in IS NULL OR a.status = ANY(v_sit_in))
          AND (v_sit_not IS NULL OR a.status IS NULL OR a.status <> ALL(v_sit_not))
          AND (EXISTS (SELECT 1 FROM audiencias_advogados aa
                        WHERE aa.audiencia_id = a.id AND aa.advogado_id = p_usuario)
               OR EXISTS (SELECT 1 FROM audiencia_envolvidos ae
                           WHERE ae.audiencia_id = a.id AND ae.usuario_id = p_usuario)
               OR (a.criado_por = p_usuario
                   AND (a.origem IS NULL OR a.origem NOT IN ('importacao','pauta_excel'))))
        ORDER BY a.data_audiencia NULLS LAST, a.id
        LIMIT v_lim OFFSET v_off
      ) x;
    v_out := v_out || jsonb_build_object('audiencias',
      jsonb_build_object('linhas', v_rows, 'tem_mais', jsonb_array_length(v_rows) >= v_lim));
  END IF;

  -- ============ PARCELAS ============
  IF 'parcelas' = ANY(v_fontes) THEN
    SELECT COALESCE(jsonb_agg(x.linha ORDER BY x.data_vencimento NULLS LAST, x.id), '[]'::jsonb)
      INTO v_rows
      FROM (
        SELECT jsonb_build_object(
                 'id', pe.id, 'evento_id', pe.evento_id, 'numero', pe.numero,
                 'data_vencimento', pe.data_vencimento, 'valor', pe.valor, 'status', pe.status,
                 'observacoes', pe.observacoes, 'created_at', pe.created_at, 'updated_at', pe.updated_at,
                 'parent', jsonb_build_object(
                   'id', x0.id, 'titulo', x0.titulo, 'descricao', x0.descricao, 'local', x0.local,
                   'processo_id', x0.processo_id, 'criado_por', x0.criado_por, 'status', x0.status,
                   'coordenacao_id', COALESCE(x0.coordenacao_id, pp.coordenacao_id),
                   'processo', CASE WHEN pp.id IS NULL THEN NULL
                         ELSE jsonb_build_object('id', pp.id, 'numero', pp.numero,
                                                 'coordenacao_id', pp.coordenacao_id) END)
               ) AS linha,
               pe.id, pe.data_vencimento
        FROM parcelas_evento pe
        JOIN eventos_agenda x0 ON x0.id = pe.evento_id
        LEFT JOIN processos pp ON pp.id = x0.processo_id
        WHERE pe.data_vencimento >= v_ini AND pe.data_vencimento <= v_fim
          AND (x0.criado_por = p_usuario
               OR (x0.data_inicio >= v_ini_ts AND x0.data_inicio <= v_fim_ts
                   AND EXISTS (SELECT 1 FROM participantes_evento pe3
                               WHERE pe3.evento_id = x0.id AND pe3.usuario_id = p_usuario)))
        ORDER BY pe.data_vencimento NULLS LAST, pe.id
        LIMIT v_lim OFFSET v_off
      ) x;
    v_out := v_out || jsonb_build_object('parcelas',
      jsonb_build_object('linhas', v_rows, 'tem_mais', jsonb_array_length(v_rows) >= v_lim));
  END IF;

  RETURN v_out;
END;
$fn$;

-- ============================================================================
-- Modo Escritório: tudo do período nas coordenações informadas.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_agenda_escritorio(
  p_coordenacoes uuid[],
  p_inicio date,
  p_fim date,
  p_inicio_ts timestamptz DEFAULT NULL,
  p_fim_ts timestamptz DEFAULT NULL,
  p_fontes text[] DEFAULT NULL,
  p_tipos text[] DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_status_in text[] DEFAULT NULL,
  p_status_not_in text[] DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 1000
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $fn$
DECLARE
  v_fontes text[] := NULLIF(array_remove(p_fontes, NULL::text), '{}');
  v_ui text[] := NULLIF(array_remove(p_tipos, NULL::text), '{}');
  v_task_tipos text[];
  v_event_tipos text[];
  v_coords uuid[] := NULLIF(coalesce(p_coordenacoes, '{}'), '{}');
  v_ini date := p_inicio;
  v_fim date := p_fim;
  v_ini_ts timestamptz := COALESCE(p_inicio_ts, p_inicio::timestamptz);
  v_fim_ts timestamptz := COALESCE(p_fim_ts, (p_fim + 1)::timestamptz - interval '1 microsecond');
  v_status text := NULLIF(p_status, '');
  v_sit_in text[] := NULLIF(coalesce(p_status_in, '{}'), '{}');
  v_sit_not text[] := NULLIF(coalesce(p_status_not_in, '{}'), '{}');
  v_lim integer := GREATEST(COALESCE(p_limit, 1000), 1);
  v_off integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_rows jsonb;
  v_out jsonb := '{}'::jsonb;
BEGIN
  -- Sem coordenação informada não há o que montar: o navegador usa outra busca.
  IF v_coords IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  IF v_fontes IS NULL THEN
    v_fontes := ARRAY['tarefas','eventos','prazos_tst','audiencias','parcelas'];
  END IF;

  IF v_ui IS NULL THEN
    v_task_tipos := ARRAY['tarefa','prazo','audiencia','evento','parcelamento'];
    v_event_tipos := ARRAY['evento','prazo','audiencia','parcelamento','prazo_parcela'];
  ELSE
    SELECT COALESCE(array_agg(DISTINCT CASE WHEN x = 'tarefa_delegada' THEN 'tarefa' ELSE x END)
                      FILTER (WHERE x IN ('tarefa','tarefa_delegada','prazo','audiencia','evento','parcelamento')), '{}')
      INTO v_task_tipos FROM unnest(v_ui) x;
    SELECT COALESCE(array_agg(DISTINCT x) FILTER (WHERE x IN ('evento','prazo','audiencia','parcelamento','prazo_parcela')), '{}')
      INTO v_event_tipos FROM unnest(v_ui) x;
  END IF;

  -- ============ TAREFAS (inclui Atas) ============
  IF 'tarefas' = ANY(v_fontes) THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.data_vencimento NULLS LAST, x.id), '[]'::jsonb)
      INTO v_rows
      FROM (
        SELECT
          t.id, t.titulo, t.descricao, t.data_vencimento, t.data_fatal, t.data_prevista,
          t.data_cumprimento, t.tipo_tarefa, t.status, t.prioridade, t.observacoes, t.origem,
          t.created_at, t.updated_at, t.processo_id, t.coordenacao_id, t.responsavel_id,
          t.criado_por, t.identificador_projuris, t.hora_fatal, t.hora_prevista, t.data_base,
          t.prazo_dias, t.prazo_unidade, t.link_local, t.orgao, t.partes_ativas, t.partes_passivas,
          t.recorrente, t.recorrencia_tipo, t.recorrencia_intervalo, t.recorrencia_fim,
          t.recorrencia_rrule,
          CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id', p.id, 'numero', p.numero,
               'assunto', p.assunto, 'cliente_id', p.cliente_id, 'coordenacao_id', p.coordenacao_id) END AS processo,
          CASE WHEN rp.id IS NULL THEN NULL ELSE jsonb_build_object('id', rp.id, 'nome', rp.nome) END AS responsavel,
          CASE WHEN rc.id IS NULL THEN NULL ELSE jsonb_build_object('id', rc.id, 'nome', rc.nome) END AS criador,
          jsonb_build_array(jsonb_build_object('count',
            (SELECT count(*) FROM documentos d WHERE d.tarefa_id = t.id))) AS documentos,
          COALESCE((SELECT jsonb_agg(tr.usuario_id) FROM tarefa_responsaveis tr
                     WHERE tr.tarefa_id = t.id), '[]'::jsonb) AS responsaveis,
          COALESCE((SELECT jsonb_agg(te.usuario_id) FROM tarefa_envolvidos te
                     WHERE te.tarefa_id = t.id), '[]'::jsonb) AS envolvidos
        FROM tarefas t
        LEFT JOIN processos p ON p.id = t.processo_id
        LEFT JOIN profiles_basic rp ON rp.id = t.responsavel_id
        LEFT JOIN profiles_basic rc ON rc.id = t.criado_por
        WHERE t.id IN (
          SELECT u.id FROM (
            (SELECT t2.id, t2.data_vencimento FROM tarefas t2
              WHERE t2.data_vencimento >= v_ini AND t2.data_vencimento <= v_fim
                AND (CASE upper(btrim(coalesce(t2.tipo_tarefa, '')))
                        WHEN 'AUDIÊNCIA' THEN 'audiencia' WHEN 'AUDIENCIA' THEN 'audiencia'
                        WHEN 'PRAZO' THEN 'prazo' WHEN 'EVENTO' THEN 'evento'
                        WHEN 'PARCELAMENTO' THEN 'parcelamento'
                        WHEN 'PARCELAMENTO_RECORRENTE' THEN 'parcelamento'
                        ELSE 'tarefa' END) = ANY(v_task_tipos)
                AND (t2.coordenacao_id = ANY(v_coords)
                     OR (t2.coordenacao_id IS NULL AND EXISTS
                           (SELECT 1 FROM processos pp2
                             WHERE pp2.id = t2.processo_id AND pp2.coordenacao_id = ANY(v_coords))))
                AND (v_status IS NULL
                     OR (v_status = 'pendente' AND t2.status = 'pendente')
                     OR (v_status = 'concluido' AND t2.status = 'cumprido'))
                AND (v_sit_in IS NULL OR t2.status::text = ANY(v_sit_in))
                AND (v_sit_not IS NULL OR t2.status::text <> ALL(v_sit_not)))
            UNION ALL
            (SELECT t3.id, t3.data_vencimento FROM tarefas t3
              WHERE t3.recorrencia_tipo IS NOT NULL AND t3.data_vencimento < v_ini
                AND (CASE upper(btrim(coalesce(t3.tipo_tarefa, '')))
                        WHEN 'AUDIÊNCIA' THEN 'audiencia' WHEN 'AUDIENCIA' THEN 'audiencia'
                        WHEN 'PRAZO' THEN 'prazo' WHEN 'EVENTO' THEN 'evento'
                        WHEN 'PARCELAMENTO' THEN 'parcelamento'
                        WHEN 'PARCELAMENTO_RECORRENTE' THEN 'parcelamento'
                        ELSE 'tarefa' END) = ANY(v_task_tipos)
                AND (t3.coordenacao_id = ANY(v_coords)
                     OR (t3.coordenacao_id IS NULL AND EXISTS
                           (SELECT 1 FROM processos pp3
                             WHERE pp3.id = t3.processo_id AND pp3.coordenacao_id = ANY(v_coords))))
                AND (v_status IS NULL
                     OR (v_status = 'pendente' AND t3.status = 'pendente')
                     OR (v_status = 'concluido' AND t3.status = 'cumprido'))
                AND (v_sit_in IS NULL OR t3.status::text = ANY(v_sit_in))
                AND (v_sit_not IS NULL OR t3.status::text <> ALL(v_sit_not)))
          ) u
          ORDER BY u.data_vencimento NULLS LAST, u.id
          LIMIT v_lim OFFSET v_off
        )
      ) x;
    v_out := v_out || jsonb_build_object('tarefas',
      jsonb_build_object('linhas', v_rows, 'tem_mais', jsonb_array_length(v_rows) >= v_lim));
  END IF;

  -- ============ EVENTOS ============
  IF 'eventos' = ANY(v_fontes) THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.data_inicio NULLS LAST, x.id), '[]'::jsonb)
      INTO v_rows
      FROM (
        SELECT e.*,
          CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id', p.id, 'numero', p.numero,
               'assunto', p.assunto, 'coordenacao_id', p.coordenacao_id) END AS processo,
          jsonb_build_array(jsonb_build_object('count',
            (SELECT count(*) FROM documentos d WHERE d.evento_id = e.id))) AS documentos,
          COALESCE((SELECT jsonb_agg(jsonb_build_object('evento_id', e.id, 'usuario_id', pe.usuario_id,
                          'usuario', CASE WHEN pp.id IS NULL THEN NULL
                                          ELSE jsonb_build_object('id', pp.id, 'nome', pp.nome) END))
                     FROM participantes_evento pe
                     LEFT JOIN profiles_basic pp ON pp.id = pe.usuario_id
                     WHERE pe.evento_id = e.id), '[]'::jsonb) AS participantes
        FROM eventos_agenda e
        LEFT JOIN processos p ON p.id = e.processo_id
        WHERE e.id IN (
          SELECT u.id FROM (
            (SELECT e2.id, e2.data_inicio FROM eventos_agenda e2
              WHERE e2.data_inicio >= v_ini_ts AND e2.data_inicio <= v_fim_ts
                AND coalesce(e2.tipo, '') = ANY(v_event_tipos)
                AND (e2.coordenacao_id = ANY(v_coords)
                     OR EXISTS (SELECT 1 FROM processos pp2
                                 WHERE pp2.id = e2.processo_id AND pp2.coordenacao_id = ANY(v_coords))
                     OR EXISTS (SELECT 1 FROM evento_processos ep2
                                 JOIN processos pp3 ON pp3.id = ep2.processo_id
                                 WHERE ep2.evento_id = e2.id AND pp3.coordenacao_id = ANY(v_coords))))
            UNION ALL
            (SELECT e3.id, e3.data_inicio FROM eventos_agenda e3
              WHERE e3.data_inicio < v_ini_ts
                AND (e3.recorrente OR e3.recorrencia_tipo IS NOT NULL)
                AND coalesce(e3.tipo, '') = ANY(v_event_tipos)
                AND (e3.coordenacao_id = ANY(v_coords)
                     OR EXISTS (SELECT 1 FROM processos pp4
                                 WHERE pp4.id = e3.processo_id AND pp4.coordenacao_id = ANY(v_coords))
                     OR EXISTS (SELECT 1 FROM evento_processos ep4
                                 JOIN processos pp5 ON pp5.id = ep4.processo_id
                                 WHERE ep4.evento_id = e3.id AND pp5.coordenacao_id = ANY(v_coords))))
            UNION ALL
            (SELECT e4.id, e4.data_inicio FROM eventos_agenda e4
              WHERE e4.data_inicio < v_ini_ts AND e4.data_fim >= v_ini_ts
                AND coalesce(e4.tipo, '') = ANY(v_event_tipos)
                AND (e4.coordenacao_id = ANY(v_coords)
                     OR EXISTS (SELECT 1 FROM processos pp6
                                 WHERE pp6.id = e4.processo_id AND pp6.coordenacao_id = ANY(v_coords))
                     OR EXISTS (SELECT 1 FROM evento_processos ep6
                                 JOIN processos pp7 ON pp7.id = ep6.processo_id
                                 WHERE ep6.evento_id = e4.id AND pp7.coordenacao_id = ANY(v_coords))))
          ) u
          ORDER BY u.data_inicio NULLS LAST, u.id
          LIMIT v_lim OFFSET v_off
        )
      ) x;
    v_out := v_out || jsonb_build_object('eventos',
      jsonb_build_object('linhas', v_rows, 'tem_mais', jsonb_array_length(v_rows) >= v_lim));
  END IF;

  -- ============ PRAZOS FATAIS DO TST ============
  IF 'prazos_tst' = ANY(v_fontes) THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.data_fatal NULLS LAST, x.id), '[]'::jsonb)
      INTO v_rows
      FROM (
        SELECT pr.id, pr.numero, pr.polo_ativo, pr.polo_passivo, pr.data_fatal, pr.coordenacao_id,
               pr.criado_por_tst, pr.responsavel_tst_id, pr.responsavel_tst, pr.equipe_tst,
               pr.decisao_tst, pr.status, pr.prazo_fatal_conferido,
               CASE WHEN rp.id IS NULL THEN NULL ELSE jsonb_build_object('id', rp.id, 'nome', rp.nome) END AS responsavel,
               CASE WHEN rc.id IS NULL THEN NULL ELSE jsonb_build_object('id', rc.id, 'nome', rc.nome) END AS criador
        FROM processos pr
        LEFT JOIN profiles_basic rp ON rp.id = pr.responsavel_tst_id
        LEFT JOIN profiles_basic rc ON rc.id = pr.criado_por_tst
        WHERE pr.data_fatal IS NOT NULL
          AND pr.data_fatal >= v_ini AND pr.data_fatal <= v_fim
          AND pr.coordenacao_id = ANY(v_coords)
        ORDER BY pr.data_fatal NULLS LAST, pr.id
        LIMIT v_lim OFFSET v_off
      ) x;
    v_out := v_out || jsonb_build_object('prazos_tst',
      jsonb_build_object('linhas', v_rows, 'tem_mais', jsonb_array_length(v_rows) >= v_lim));
  END IF;

  -- ============ AUDIÊNCIAS DETECTADAS ============
  IF 'audiencias' = ANY(v_fontes) THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.data_audiencia NULLS LAST, x.id), '[]'::jsonb)
      INTO v_rows
      FROM (
        SELECT a.id, a.titulo, a.tipo_audiencia, a.processo_id, a.processo_numero, a.data_audiencia,
               a.hora, a.hora_fim, a.status, a.observacoes, a.local_audiencia, a.forum, a.sala_forum,
               a.modalidade, a.criado_por, a.coordenacao_id, a.created_at, a.updated_at,
               jsonb_build_array(jsonb_build_object('count',
                 (SELECT count(*) FROM documentos d WHERE d.audiencia_id = a.id))) AS documentos
        FROM audiencias_detectadas a
        WHERE a.data_audiencia IS NOT NULL
          AND a.data_audiencia >= v_ini_ts AND a.data_audiencia <= v_fim_ts
          AND (v_sit_in IS NULL OR a.status = ANY(v_sit_in))
          AND (v_sit_not IS NULL OR a.status IS NULL OR a.status <> ALL(v_sit_not))
          AND a.coordenacao_id = ANY(v_coords)
        ORDER BY a.data_audiencia NULLS LAST, a.id
        LIMIT v_lim OFFSET v_off
      ) x;
    v_out := v_out || jsonb_build_object('audiencias',
      jsonb_build_object('linhas', v_rows, 'tem_mais', jsonb_array_length(v_rows) >= v_lim));
  END IF;

  -- ============ PARCELAS ============
  IF 'parcelas' = ANY(v_fontes) THEN
    SELECT COALESCE(jsonb_agg(x.linha ORDER BY x.data_vencimento NULLS LAST, x.id), '[]'::jsonb)
      INTO v_rows
      FROM (
        SELECT jsonb_build_object(
                 'id', pe.id, 'evento_id', pe.evento_id, 'numero', pe.numero,
                 'data_vencimento', pe.data_vencimento, 'valor', pe.valor, 'status', pe.status,
                 'observacoes', pe.observacoes, 'created_at', pe.created_at, 'updated_at', pe.updated_at,
                 'parent', jsonb_build_object(
                   'id', x0.id, 'titulo', x0.titulo, 'descricao', x0.descricao, 'local', x0.local,
                   'processo_id', x0.processo_id, 'criado_por', x0.criado_por, 'status', x0.status,
                   'coordenacao_id', COALESCE(x0.coordenacao_id, pp.coordenacao_id),
                   'processo', CASE WHEN pp.id IS NULL THEN NULL
                         ELSE jsonb_build_object('id', pp.id, 'numero', pp.numero,
                                                 'coordenacao_id', pp.coordenacao_id) END)
               ) AS linha,
               pe.id, pe.data_vencimento
        FROM parcelas_evento pe
        JOIN eventos_agenda x0 ON x0.id = pe.evento_id
        LEFT JOIN processos pp ON pp.id = x0.processo_id
        WHERE pe.data_vencimento >= v_ini AND pe.data_vencimento <= v_fim
          AND (x0.coordenacao_id = ANY(v_coords)
               OR pp.coordenacao_id = ANY(v_coords)
               OR EXISTS (SELECT 1 FROM evento_processos ep3
                           JOIN processos pp4 ON pp4.id = ep3.processo_id
                           WHERE ep3.evento_id = x0.id AND pp4.coordenacao_id = ANY(v_coords)))
        ORDER BY pe.data_vencimento NULLS LAST, pe.id
        LIMIT v_lim OFFSET v_off
      ) x;
    v_out := v_out || jsonb_build_object('parcelas',
      jsonb_build_object('linhas', v_rows, 'tem_mais', jsonb_array_length(v_rows) >= v_lim));
  END IF;

  RETURN v_out;
END;
$fn$;

-- ============================================================================
-- Quem pode chamar: só usuários autenticados (e o serviço).
-- ============================================================================
REVOKE ALL ON FUNCTION public.get_agenda_pessoal(uuid, date, date, timestamptz, timestamptz, text[], text[], text, text[], text[], integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_agenda_escritorio(uuid[], date, date, timestamptz, timestamptz, text[], text[], text, text[], text[], integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agenda_pessoal(uuid, date, date, timestamptz, timestamptz, text[], text[], text, text[], text[], integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agenda_escritorio(uuid[], date, date, timestamptz, timestamptz, text[], text[], text, text[], text[], integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_agenda_pessoal(uuid, date, date, timestamptz, timestamptz, text[], text[], text, text[], text[], integer, integer) TO service_role;
GRANT ALL ON FUNCTION public.get_agenda_escritorio(uuid[], date, date, timestamptz, timestamptz, text[], text[], text, text[], text[], integer, integer) TO service_role;