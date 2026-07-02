
CREATE OR REPLACE FUNCTION public.descartar_duplicadas_coordenacao(
  p_coordenacao_id uuid,
  p_data_disp_inicio date DEFAULT NULL::date,
  p_data_disp_fim date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_nome text;
  v_lote_id uuid := gen_random_uuid();
  v_total integer := 0;
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.membros_coordenacao
      WHERE usuario_id = v_user_id AND coordenacao_id = p_coordenacao_id
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para esta coordenação';
  END IF;

  SELECT COALESCE(nome, email, 'Usuário') INTO v_user_nome
  FROM public.profiles WHERE id = v_user_id;

  CREATE TEMP TABLE IF NOT EXISTS _dup_ids (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _dup_ids;

  -- REGRA DE DEDUPLICAÇÃO ALINHADA COM A UI (src/utils/djenDedup.ts):
  --   chave = (coordenacao_id, id_djen)
  --   Registros sem id_djen NUNCA são deduplicados (não há base segura).
  --   Em empate, mantém o de maior conteúdo; se igual, prefere origem 'processo'.
  INSERT INTO _dup_ids (id)
  WITH candidatos AS (
    SELECT
      pd.id,
      pd.created_at,
      COALESCE(pd.coordenacao_id, md.coordenacao_id) AS coord_id,
      NULLIF(TRIM(pd.id_djen::text), '') AS id_djen_norm,
      length(COALESCE(pd.conteudo, '')) AS conteudo_len,
      -- Preferência: 'processo' (0) antes de 'termo' (1) — menor ordena primeiro
      CASE
        WHEN EXISTS (
          SELECT 1 FROM public.publicacoes_djen_processos pdp
          WHERE pdp.publicacao_djen_id = pd.id
        ) THEN 0 ELSE 1
      END AS origem_ord
    FROM public.publicacoes_djen pd
    LEFT JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
    WHERE pd.status IN ('encontrada','duplicada')
      AND (pd.coordenacao_id = p_coordenacao_id OR (pd.coordenacao_id IS NULL AND md.coordenacao_id = p_coordenacao_id))
      AND (
        p_data_disp_inicio IS NULL
        OR (COALESCE(pd.data_publicacao, pd.data_disponibilizacao, pd.created_at) AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_disp_inicio
      )
      AND (
        p_data_disp_fim IS NULL
        OR (COALESCE(pd.data_publicacao, pd.data_disponibilizacao, pd.created_at) AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_disp_fim
      )
  ), ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY coord_id, id_djen_norm
        ORDER BY conteudo_len DESC, origem_ord ASC, created_at ASC, id ASC
      ) AS rn
    FROM candidatos
    WHERE id_djen_norm IS NOT NULL
  )
  SELECT id FROM ranked WHERE rn > 1;

  INSERT INTO public.publicacoes_djen_descartadas (
    monitoramento_id, hash_conteudo, data_publicacao, processo_numero,
    conteudo, fonte, motivo_descarte, data_disponibilizacao, tribunal,
    lida, orgao, tipo_comunicacao, meio, partes_json, advogados_json,
    dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id, id_djen,
    descartado_por, descartado_por_nome, lote_descarte_id,
    tipo_origem_origem, id_origem, payload_origem
  )
  SELECT
    p.monitoramento_id, p.hash_conteudo, p.data_publicacao, p.processo_numero,
    p.conteudo, p.fonte, 'duplicada_lote_id_djen', p.data_disponibilizacao, p.tribunal,
    p.lida, p.orgao, p.tipo_comunicacao, p.meio, p.partes_json, p.advogados_json,
    p.dedup_processo_digits, p.dedup_data_ref, p.dedup_head_norm, p.coordenacao_id, p.id_djen,
    v_user_id, v_user_nome, v_lote_id,
    'djen', p.id, to_jsonb(p.*)
  FROM public.publicacoes_djen p
  JOIN _dup_ids d ON d.id = p.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := COALESCE(v_count, 0);

  DELETE FROM public.publicacoes_djen WHERE id IN (SELECT id FROM _dup_ids);

  RETURN jsonb_build_object(
    'success', true,
    'total_descartadas', v_total,
    'lote_id', v_lote_id
  );
END;
$function$;
