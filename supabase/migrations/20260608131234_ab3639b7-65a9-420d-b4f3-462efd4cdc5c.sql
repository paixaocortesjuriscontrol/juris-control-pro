
-- Allow monitoramento_id NULL (processo-origin discards) and add audit columns
ALTER TABLE public.publicacoes_djen_descartadas
  ALTER COLUMN monitoramento_id DROP NOT NULL;

ALTER TABLE public.publicacoes_djen_descartadas
  ADD COLUMN IF NOT EXISTS descartado_por uuid,
  ADD COLUMN IF NOT EXISTS descartado_por_nome text,
  ADD COLUMN IF NOT EXISTS lote_descarte_id uuid,
  ADD COLUMN IF NOT EXISTS tipo_origem_origem text,
  ADD COLUMN IF NOT EXISTS id_origem uuid,
  ADD COLUMN IF NOT EXISTS payload_origem jsonb;

CREATE INDEX IF NOT EXISTS idx_djen_descartadas_lote
  ON public.publicacoes_djen_descartadas(lote_descarte_id)
  WHERE lote_descarte_id IS NOT NULL;

-- ===========================================================================
-- RPC: descartar duplicadas dentro de uma coordenação
-- Mantém a publicação mais antiga (created_at MIN) por grupo
-- (dedup_processo_digits + dedup_data_ref + dedup_head_norm) e move as demais
-- para publicacoes_djen_descartadas com motivo 'duplicada_lote'.
-- Retorna {lote_id, total} para permitir desfazer.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.descartar_duplicadas_coordenacao(
  p_coordenacao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_nome text;
  v_lote_id uuid := gen_random_uuid();
  v_total integer := 0;
  v_inserted integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Verifica vínculo à coordenação (admin tem passe livre)
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

  -- ============ publicacoes_djen (termo) ============
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY dedup_processo_digits, dedup_data_ref, dedup_head_norm
             ORDER BY created_at ASC, id ASC
           ) AS rn
    FROM public.publicacoes_djen
    WHERE coordenacao_id = p_coordenacao_id
      AND dedup_processo_digits IS NOT NULL
      AND dedup_data_ref IS NOT NULL
      AND dedup_head_norm IS NOT NULL
  ),
  dups AS (
    SELECT id FROM ranked WHERE rn > 1
  ),
  moved AS (
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
      p.lida, p.orgao, p.tipo_comunicacao, p.meio, p.partes_json, p.advogados_json,
      p.dedup_processo_digits, p.dedup_data_ref, p.dedup_head_norm, p.coordenacao_id, p.id_djen,
      v_user_id, v_user_nome, v_lote_id,
      'termo', p.id, to_jsonb(p.*)
    FROM public.publicacoes_djen p
    JOIN dups d ON d.id = p.id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM moved;
  v_total := v_total + COALESCE(v_inserted, 0);

  DELETE FROM public.publicacoes_djen
  WHERE id IN (
    SELECT id FROM public.publicacoes_djen_descartadas
    WHERE lote_descarte_id = v_lote_id AND tipo_origem_origem = 'termo'
  );

  -- ============ publicacoes_djen_processos (processo) ============
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY dedup_processo_digits, dedup_data_ref, dedup_head_norm
             ORDER BY created_at ASC, id ASC
           ) AS rn
    FROM public.publicacoes_djen_processos
    WHERE coordenacao_id = p_coordenacao_id
      AND dedup_processo_digits IS NOT NULL
      AND dedup_data_ref IS NOT NULL
      AND dedup_head_norm IS NOT NULL
  ),
  dups AS (
    SELECT id FROM ranked WHERE rn > 1
  ),
  moved AS (
    INSERT INTO public.publicacoes_djen_descartadas (
      monitoramento_id, hash_conteudo, data_publicacao, processo_numero,
      conteudo, fonte, motivo_descarte, data_disponibilizacao, tribunal,
      lida, orgao, tipo_comunicacao, meio, partes_json, advogados_json,
      dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id, id_djen,
      descartado_por, descartado_por_nome, lote_descarte_id,
      tipo_origem_origem, id_origem, payload_origem
    )
    SELECT
      NULL, p.hash_conteudo, p.data_publicacao, p.processo_numero,
      p.conteudo, p.fonte, 'duplicada_lote', p.data_disponibilizacao, p.tribunal,
      p.lida, p.orgao, p.tipo_comunicacao, p.meio, p.partes_json, p.advogados_json,
      p.dedup_processo_digits, p.dedup_data_ref, p.dedup_head_norm, p.coordenacao_id, p.id_djen,
      v_user_id, v_user_nome, v_lote_id,
      'processo', p.id, to_jsonb(p.*)
    FROM public.publicacoes_djen_processos p
    JOIN dups d ON d.id = p.id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM moved;
  v_total := v_total + COALESCE(v_inserted, 0);

  DELETE FROM public.publicacoes_djen_processos
  WHERE id IN (
    SELECT id FROM public.publicacoes_djen_descartadas
    WHERE lote_descarte_id = v_lote_id AND tipo_origem_origem = 'processo'
  );

  RETURN jsonb_build_object(
    'lote_id', v_lote_id,
    'total', v_total,
    'descartado_por_nome', v_user_nome
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.descartar_duplicadas_coordenacao(uuid) TO authenticated;

-- ===========================================================================
-- RPC: desfazer descarte em lote (qualquer usuário autenticado pode desfazer)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.desfazer_descarte_lote(
  p_lote_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_termo_restaurado integer := 0;
  v_proc_restaurado integer := 0;
  r record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Restaura cada linha do lote para sua tabela de origem
  FOR r IN
    SELECT id, tipo_origem_origem, id_origem, payload_origem
    FROM public.publicacoes_djen_descartadas
    WHERE lote_descarte_id = p_lote_id
  LOOP
    IF r.tipo_origem_origem = 'termo' THEN
      INSERT INTO public.publicacoes_djen (
        id, monitoramento_id, hash_conteudo, data_publicacao, processo_numero,
        conteudo, fonte, lida, created_at, data_disponibilizacao, tribunal,
        orgao, tipo_comunicacao, meio, partes_json, advogados_json,
        dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id, id_djen,
        polo_ativo, polo_passivo, status, dedup_key, tipo_publicacao,
        kurier_login, dedup_conteudo_key, publicacao_unica, importada_de_descartada,
        resumo_ia, resumo_gerado_em
      )
      SELECT
        (r.payload_origem->>'id')::uuid,
        NULLIF(r.payload_origem->>'monitoramento_id','')::uuid,
        r.payload_origem->>'hash_conteudo',
        NULLIF(r.payload_origem->>'data_publicacao','')::timestamptz,
        r.payload_origem->>'processo_numero',
        r.payload_origem->>'conteudo',
        r.payload_origem->>'fonte',
        COALESCE((r.payload_origem->>'lida')::boolean, false),
        COALESCE(NULLIF(r.payload_origem->>'created_at','')::timestamptz, now()),
        NULLIF(r.payload_origem->>'data_disponibilizacao','')::timestamptz,
        r.payload_origem->>'tribunal',
        r.payload_origem->>'orgao',
        r.payload_origem->>'tipo_comunicacao',
        r.payload_origem->>'meio',
        COALESCE(r.payload_origem->'partes_json','[]'::jsonb),
        r.payload_origem->'advogados_json',
        r.payload_origem->>'dedup_processo_digits',
        NULLIF(r.payload_origem->>'dedup_data_ref','')::date,
        r.payload_origem->>'dedup_head_norm',
        NULLIF(r.payload_origem->>'coordenacao_id','')::uuid,
        r.payload_origem->>'id_djen',
        r.payload_origem->>'polo_ativo',
        r.payload_origem->>'polo_passivo',
        COALESCE((r.payload_origem->>'status')::djen_status, 'encontrada'::djen_status),
        r.payload_origem->>'dedup_key',
        COALESCE(r.payload_origem->>'tipo_publicacao','intimacao'),
        r.payload_origem->>'kurier_login',
        r.payload_origem->>'dedup_conteudo_key',
        COALESCE((r.payload_origem->>'publicacao_unica')::boolean, true),
        COALESCE((r.payload_origem->>'importada_de_descartada')::boolean, false),
        r.payload_origem->>'resumo_ia',
        NULLIF(r.payload_origem->>'resumo_gerado_em','')::timestamptz
      ON CONFLICT (id) DO NOTHING;
      v_termo_restaurado := v_termo_restaurado + 1;

    ELSIF r.tipo_origem_origem = 'processo' THEN
      INSERT INTO public.publicacoes_djen_processos (
        id, processo_id, processo_numero, conteudo, data_publicacao, data_encontrado,
        fonte, hash_conteudo, lida, created_at, data_disponibilizacao, orgao,
        tipo_comunicacao, meio, advogados_json, partes_json, tribunal,
        dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id,
        status, dedup_key, id_djen
      )
      SELECT
        (r.payload_origem->>'id')::uuid,
        (r.payload_origem->>'processo_id')::uuid,
        r.payload_origem->>'processo_numero',
        r.payload_origem->>'conteudo',
        NULLIF(r.payload_origem->>'data_publicacao','')::timestamptz,
        COALESCE(NULLIF(r.payload_origem->>'data_encontrado','')::timestamptz, now()),
        r.payload_origem->>'fonte',
        r.payload_origem->>'hash_conteudo',
        COALESCE((r.payload_origem->>'lida')::boolean, false),
        COALESCE(NULLIF(r.payload_origem->>'created_at','')::timestamptz, now()),
        NULLIF(r.payload_origem->>'data_disponibilizacao','')::timestamptz,
        r.payload_origem->>'orgao',
        r.payload_origem->>'tipo_comunicacao',
        r.payload_origem->>'meio',
        r.payload_origem->'advogados_json',
        r.payload_origem->'partes_json',
        r.payload_origem->>'tribunal',
        r.payload_origem->>'dedup_processo_digits',
        NULLIF(r.payload_origem->>'dedup_data_ref','')::date,
        r.payload_origem->>'dedup_head_norm',
        NULLIF(r.payload_origem->>'coordenacao_id','')::uuid,
        COALESCE(r.payload_origem->>'status','encontrada'),
        r.payload_origem->>'dedup_key',
        r.payload_origem->>'id_djen'
      ON CONFLICT (id) DO NOTHING;
      v_proc_restaurado := v_proc_restaurado + 1;
    END IF;
  END LOOP;

  DELETE FROM public.publicacoes_djen_descartadas
  WHERE lote_descarte_id = p_lote_id;

  RETURN jsonb_build_object(
    'restaurado_termo', v_termo_restaurado,
    'restaurado_processo', v_proc_restaurado,
    'total', v_termo_restaurado + v_proc_restaurado
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.desfazer_descarte_lote(uuid) TO authenticated;
