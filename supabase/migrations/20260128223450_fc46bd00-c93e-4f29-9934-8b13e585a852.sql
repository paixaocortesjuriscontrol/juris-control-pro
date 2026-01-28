
-- RPC para marcar como lidas TODAS as publicações que correspondem aos mesmos hashes de deduplicação
-- Isso resolve o problema onde a UI mostra apenas uma publicação deduplicada, mas existem
-- múltiplos registros subjacentes que precisam ser marcados

CREATE OR REPLACE FUNCTION public.marcar_publicacoes_lidas_por_dedup(
  p_ids_termos uuid[] DEFAULT NULL,
  p_ids_processos uuid[] DEFAULT NULL,
  p_ids_descartadas uuid[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_termos_atualizados int := 0;
  v_processos_atualizados int := 0;
  v_descartadas_atualizados int := 0;
BEGIN
  -- Para TERMOS: encontrar todos os registros que compartilham o mesmo hash de deduplicação
  -- e marcar todos como lidos
  IF p_ids_termos IS NOT NULL AND array_length(p_ids_termos, 1) > 0 THEN
    WITH dedup_keys AS (
      -- Gerar chaves de deduplicação para os IDs selecionados
      SELECT DISTINCT
        m.coordenacao_id::text || '|' ||
        regexp_replace(COALESCE(p.processo_numero, ''), '[^0-9]', '', 'g') || '|' ||
        COALESCE(
          to_char(p.data_publicacao::date, 'YYYY-MM-DD'),
          to_char(p.data_disponibilizacao::date, 'YYYY-MM-DD'),
          to_char(p.created_at::date, 'YYYY-MM-DD')
        ) || '|' ||
        left(lower(regexp_replace(regexp_replace(regexp_replace(
          COALESCE(p.conteudo, ''), '<[^>]*>', ' ', 'g'
        ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300) AS dedup_key
      FROM publicacoes_djen p
      JOIN monitoramentos_djen m ON m.id = p.monitoramento_id
      WHERE p.id = ANY(p_ids_termos)
    ),
    all_matching AS (
      -- Encontrar TODOS os registros que correspondem às mesmas chaves
      SELECT p.id
      FROM publicacoes_djen p
      JOIN monitoramentos_djen m ON m.id = p.monitoramento_id
      WHERE (
        m.coordenacao_id::text || '|' ||
        regexp_replace(COALESCE(p.processo_numero, ''), '[^0-9]', '', 'g') || '|' ||
        COALESCE(
          to_char(p.data_publicacao::date, 'YYYY-MM-DD'),
          to_char(p.data_disponibilizacao::date, 'YYYY-MM-DD'),
          to_char(p.created_at::date, 'YYYY-MM-DD')
        ) || '|' ||
        left(lower(regexp_replace(regexp_replace(regexp_replace(
          COALESCE(p.conteudo, ''), '<[^>]*>', ' ', 'g'
        ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300)
      ) IN (SELECT dedup_key FROM dedup_keys)
        AND p.lida = false
    )
    UPDATE publicacoes_djen SET lida = true
    WHERE id IN (SELECT id FROM all_matching);
    
    GET DIAGNOSTICS v_termos_atualizados = ROW_COUNT;
  END IF;

  -- Para PROCESSOS: mesma lógica
  IF p_ids_processos IS NOT NULL AND array_length(p_ids_processos, 1) > 0 THEN
    WITH dedup_keys AS (
      SELECT DISTINCT
        p.coordenacao_id::text || '|' ||
        regexp_replace(COALESCE(pp.processo_numero, ''), '[^0-9]', '', 'g') || '|' ||
        COALESCE(
          to_char(pp.data_publicacao::date, 'YYYY-MM-DD'),
          to_char(pp.data_disponibilizacao::date, 'YYYY-MM-DD'),
          to_char(pp.created_at::date, 'YYYY-MM-DD')
        ) || '|' ||
        left(lower(regexp_replace(regexp_replace(regexp_replace(
          COALESCE(pp.conteudo, ''), '<[^>]*>', ' ', 'g'
        ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300) AS dedup_key
      FROM publicacoes_djen_processos pp
      JOIN processos p ON p.id = pp.processo_id
      WHERE pp.id = ANY(p_ids_processos)
    ),
    all_matching AS (
      SELECT pp.id
      FROM publicacoes_djen_processos pp
      JOIN processos p ON p.id = pp.processo_id
      WHERE (
        p.coordenacao_id::text || '|' ||
        regexp_replace(COALESCE(pp.processo_numero, ''), '[^0-9]', '', 'g') || '|' ||
        COALESCE(
          to_char(pp.data_publicacao::date, 'YYYY-MM-DD'),
          to_char(pp.data_disponibilizacao::date, 'YYYY-MM-DD'),
          to_char(pp.created_at::date, 'YYYY-MM-DD')
        ) || '|' ||
        left(lower(regexp_replace(regexp_replace(regexp_replace(
          COALESCE(pp.conteudo, ''), '<[^>]*>', ' ', 'g'
        ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300)
      ) IN (SELECT dedup_key FROM dedup_keys)
        AND pp.lida = false
    )
    UPDATE publicacoes_djen_processos SET lida = true
    WHERE id IN (SELECT id FROM all_matching);
    
    GET DIAGNOSTICS v_processos_atualizados = ROW_COUNT;
  END IF;

  -- Para DESCARTADAS: mesma lógica
  IF p_ids_descartadas IS NOT NULL AND array_length(p_ids_descartadas, 1) > 0 THEN
    WITH dedup_keys AS (
      SELECT DISTINCT
        m.coordenacao_id::text || '|' ||
        regexp_replace(COALESCE(d.processo_numero, ''), '[^0-9]', '', 'g') || '|' ||
        COALESCE(
          to_char(d.data_publicacao::date, 'YYYY-MM-DD'),
          to_char(d.created_at::date, 'YYYY-MM-DD')
        ) || '|' ||
        left(lower(regexp_replace(regexp_replace(regexp_replace(
          COALESCE(d.conteudo, ''), '<[^>]*>', ' ', 'g'
        ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300) AS dedup_key
      FROM publicacoes_djen_descartadas d
      JOIN monitoramentos_djen m ON m.id = d.monitoramento_id
      WHERE d.id = ANY(p_ids_descartadas)
    ),
    all_matching AS (
      SELECT d.id
      FROM publicacoes_djen_descartadas d
      JOIN monitoramentos_djen m ON m.id = d.monitoramento_id
      WHERE (
        m.coordenacao_id::text || '|' ||
        regexp_replace(COALESCE(d.processo_numero, ''), '[^0-9]', '', 'g') || '|' ||
        COALESCE(
          to_char(d.data_publicacao::date, 'YYYY-MM-DD'),
          to_char(d.created_at::date, 'YYYY-MM-DD')
        ) || '|' ||
        left(lower(regexp_replace(regexp_replace(regexp_replace(
          COALESCE(d.conteudo, ''), '<[^>]*>', ' ', 'g'
        ), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300)
      ) IN (SELECT dedup_key FROM dedup_keys)
        AND d.lida = false
    )
    UPDATE publicacoes_djen_descartadas SET lida = true
    WHERE id IN (SELECT id FROM all_matching);
    
    GET DIAGNOSTICS v_descartadas_atualizados = ROW_COUNT;
  END IF;

  RETURN json_build_object(
    'termos_atualizados', v_termos_atualizados,
    'processos_atualizados', v_processos_atualizados,
    'descartadas_atualizados', v_descartadas_atualizados
  );
END;
$$;

COMMENT ON FUNCTION public.marcar_publicacoes_lidas_por_dedup IS 
'Marca como lidas todas as publicações que compartilham o mesmo hash de deduplicação. 
Resolve o problema onde a UI mostra uma publicação deduplicada, mas existem múltiplos 
registros subjacentes (de diferentes monitoramentos) que precisam ser marcados.';
