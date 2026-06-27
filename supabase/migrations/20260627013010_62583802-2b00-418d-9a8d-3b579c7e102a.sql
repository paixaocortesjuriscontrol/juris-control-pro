CREATE OR REPLACE FUNCTION public.descartar_duplicadas_coordenacao_servidor(
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_coordenacao_id IS NULL THEN
    RAISE EXCEPTION 'Coordenação obrigatória para descarte';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.membros_coordenacao
      WHERE usuario_id = v_user_id
        AND coordenacao_id = p_coordenacao_id
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para esta coordenação';
  END IF;

  SELECT COALESCE(nome, email, 'Usuário') INTO v_user_nome
  FROM public.profiles
  WHERE id = v_user_id;

  CREATE TEMP TABLE IF NOT EXISTS _dup_servidor (id uuid PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE _dup_servidor;

  -- Regra exclusiva do botão: SOMENTE a coordenação selecionada + processo +
  -- conteúdo completo normalizado, removendo apenas o bloco final de
  -- Intimado(s)/Citado(s). Nenhuma outra coordenação entra na comparação.
  INSERT INTO _dup_servidor (id)
  SELECT id
  FROM (
    SELECT
      p.id,
      ROW_NUMBER() OVER (
        PARTITION BY
          p.coordenacao_id,
          regexp_replace(COALESCE(p.processo_numero, ''), '\D', '', 'g'),
          md5(public.djen_normalize_conteudo_descarte_sem_intimados(p.conteudo))
        ORDER BY p.created_at ASC, p.id ASC
      ) AS rn
    FROM public.publicacoes_djen_servidor p
    WHERE p.coordenacao_id = p_coordenacao_id
      AND regexp_replace(COALESCE(p.processo_numero, ''), '\D', '', 'g') <> ''
      AND public.djen_normalize_conteudo_descarte_sem_intimados(p.conteudo) <> ''
      AND (
        p_data_disp_inicio IS NULL OR (
          (p.data_publicacao::date >= p_data_disp_inicio)
          OR (p.data_disponibilizacao::date >= p_data_disp_inicio)
          OR ((COALESCE(p.data_publicacao, p.data_disponibilizacao, p.created_at) AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_disp_inicio)
        )
      )
      AND (
        p_data_disp_fim IS NULL OR (
          (p.data_publicacao::date <= p_data_disp_fim)
          OR (p.data_disponibilizacao::date <= p_data_disp_fim)
          OR ((COALESCE(p.data_publicacao, p.data_disponibilizacao, p.created_at) AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_disp_fim)
        )
      )
  ) r
  WHERE rn > 1;

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
    p.conteudo, p.fonte, 'duplicada_lote', p.data_disponibilizacao, p.tribunal,
    false, p.orgao, p.tipo_comunicacao, p.meio, p.partes_json, p.advogados_json,
    p.dedup_processo_digits, p.dedup_data_ref, p.dedup_head_norm, p.coordenacao_id, p.id_djen,
    v_user_id, v_user_nome, v_lote_id,
    'servidor', p.id, to_jsonb(p.*)
  FROM public.publicacoes_djen_servidor p
  JOIN _dup_servidor d ON d.id = p.id
  WHERE p.coordenacao_id = p_coordenacao_id;

  GET DIAGNOSTICS v_total = ROW_COUNT;

  DELETE FROM public.publicacoes_djen_servidor p
  USING _dup_servidor d
  WHERE p.id = d.id
    AND p.coordenacao_id = p_coordenacao_id;

  RETURN jsonb_build_object(
    'lote_id', v_lote_id,
    'total', v_total,
    'descartado_por_nome', v_user_nome,
    'data_inicio', p_data_disp_inicio,
    'data_fim', p_data_disp_fim,
    'coordenacao_id', p_coordenacao_id,
    'regra', 'somente_coordenacao_selecionada+processo+conteudo_completo_sem_intimados',
    'origem', 'servidor'
  );
END;
$function$;