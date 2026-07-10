
-- =====================================================================
-- 1) RPC canônico usado por humanos e robôs para gravar audiência
-- =====================================================================
CREATE OR REPLACE FUNCTION public.criar_audiencia_detectada(
  p_processo_id uuid,
  p_processo_numero text,
  p_titulo text DEFAULT NULL,
  p_data_audiencia date DEFAULT NULL,
  p_hora text DEFAULT NULL,
  p_tipo_audiencia text DEFAULT NULL,
  p_local_audiencia text DEFAULT NULL,
  p_contexto text DEFAULT NULL,
  p_conteudo_publicacao text DEFAULT NULL,
  p_movimentacao_id uuid DEFAULT NULL,
  p_publicacao_id uuid DEFAULT NULL,
  p_origem text DEFAULT 'sistema'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_data_ts timestamptz;
  v_hora text;
  v_coord uuid;
  v_titulo text;
  v_resp record;
  v_config record;
  v_minuto int;
  v_alerta_ids uuid[];
BEGIN
  IF p_processo_numero IS NULL OR btrim(p_processo_numero) = '' THEN
    RETURN NULL;
  END IF;

  -- Deduplicação: mesmo processo + mesma publicação/movimentação/contexto já registrada
  SELECT id INTO v_id
  FROM public.audiencias_detectadas
  WHERE processo_numero = p_processo_numero
    AND (
      (p_publicacao_id IS NOT NULL AND publicacao_id = p_publicacao_id)
      OR (p_movimentacao_id IS NOT NULL AND movimentacao_id = p_movimentacao_id)
      OR (p_contexto IS NOT NULL AND contexto = p_contexto)
    )
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Monta timestamp igual ao form manual: T{hora|12:00}:00-03:00
  v_hora := COALESCE(NULLIF(btrim(p_hora), ''), '12:00');
  IF p_data_audiencia IS NOT NULL THEN
    v_data_ts := (p_data_audiencia::text || 'T' || v_hora || ':00-03:00')::timestamptz;
  ELSE
    v_data_ts := NULL;
  END IF;

  -- Coordenação vem do processo
  IF p_processo_id IS NOT NULL THEN
    SELECT coordenacao_id INTO v_coord FROM public.processos WHERE id = p_processo_id;
  END IF;

  v_titulo := COALESCE(NULLIF(btrim(p_titulo), ''),
                       COALESCE(p_tipo_audiencia, 'Audiência') || ' - ' || p_processo_numero);

  INSERT INTO public.audiencias_detectadas (
    processo_id, processo_numero, titulo, data_audiencia, hora,
    tipo_audiencia, local_audiencia, contexto, conteudo_publicacao,
    movimentacao_id, publicacao_id, origem, coordenacao_id, status
  ) VALUES (
    p_processo_id, p_processo_numero, v_titulo, v_data_ts, NULLIF(p_hora,''),
    p_tipo_audiencia, p_local_audiencia, p_contexto,
    LEFT(COALESCE(p_conteudo_publicacao,''), 5000),
    p_movimentacao_id, p_publicacao_id, COALESCE(p_origem,'sistema'), v_coord, 'pendente'
  )
  RETURNING id INTO v_id;

  -- Vincula responsáveis do processo como advogados da audiência (mesma estrutura do form manual)
  IF p_processo_id IS NOT NULL THEN
    INSERT INTO public.audiencias_advogados (audiencia_id, advogado_id)
    SELECT v_id, pr.usuario_id
    FROM public.processos_responsaveis pr
    WHERE pr.processo_id = p_processo_id
      AND COALESCE(pr.ativo, true) = true
      AND pr.usuario_id IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- Notifica cada advogado
    INSERT INTO public.notificacoes (usuario_id, titulo, mensagem, tipo, link, dados)
    SELECT pr.usuario_id,
           '📋 Nova audiência atribuída',
           'Você foi designado para a audiência do processo ' || p_processo_numero ||
             COALESCE(' em ' || to_char(v_data_ts AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'), ''),
           'info', '/painel-audiencias',
           jsonb_build_object('audiencia_id', v_id, 'processo_numero', p_processo_numero)
    FROM public.processos_responsaveis pr
    WHERE pr.processo_id = p_processo_id
      AND COALESCE(pr.ativo, true) = true
      AND pr.usuario_id IS NOT NULL;
  END IF;

  -- Lembretes automáticos a partir de config_alertas_audiencias
  SELECT * INTO v_config FROM public.config_alertas_audiencias LIMIT 1;
  IF v_config.id IS NOT NULL AND v_config.lembretes_minutos IS NOT NULL THEN
    FOREACH v_minuto IN ARRAY v_config.lembretes_minutos LOOP
      IF v_minuto IS NOT NULL AND v_minuto > 0 THEN
        INSERT INTO public.lembretes_audiencia (audiencia_id, minutos_antes, enviado)
        VALUES (v_id, v_minuto, false)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_audiencia_detectada(uuid, text, text, date, text, text, text, text, text, uuid, uuid, text)
  TO authenticated, service_role;

-- =====================================================================
-- 2) LIMPEZA: apagar tudo que não foi criado por humano
-- =====================================================================

-- 2a) Tarefas de audiência criadas por rotinas automáticas
--    (mantém apenas origem 'painel_audiencias', 'analise_djen' ou 'manual')
DELETE FROM public.tarefas
WHERE (
        LOWER(COALESCE(tipo_tarefa,'')) = 'audiencia'
        OR LOWER(COALESCE(titulo,'')) LIKE '%audiência%'
        OR LOWER(COALESCE(titulo,'')) LIKE '%audiencia%'
      )
  AND COALESCE(origem,'') NOT IN ('painel_audiencias','analise_djen','manual');

-- 2b) Audiências detectadas por robô (mantém somente origem = 'manual')
--    Cascata manual nas tabelas filhas
WITH robo AS (
  SELECT id FROM public.audiencias_detectadas WHERE COALESCE(origem,'') <> 'manual'
)
DELETE FROM public.audiencias_advogados WHERE audiencia_id IN (SELECT id FROM robo);

WITH robo AS (
  SELECT id FROM public.audiencias_detectadas WHERE COALESCE(origem,'') <> 'manual'
)
DELETE FROM public.audiencia_envolvidos WHERE audiencia_id IN (SELECT id FROM robo);

WITH robo AS (
  SELECT id FROM public.audiencias_detectadas WHERE COALESCE(origem,'') <> 'manual'
)
DELETE FROM public.lembretes_audiencia WHERE audiencia_id IN (SELECT id FROM robo);

WITH robo AS (
  SELECT id FROM public.audiencias_detectadas WHERE COALESCE(origem,'') <> 'manual'
)
DELETE FROM public.alertas_audiencias WHERE audiencia_id IN (SELECT id FROM robo);

WITH robo AS (
  SELECT id FROM public.audiencias_detectadas WHERE COALESCE(origem,'') <> 'manual'
)
DELETE FROM public.comentarios_audiencias WHERE audiencia_id IN (SELECT id FROM robo);

DELETE FROM public.audiencias_detectadas WHERE COALESCE(origem,'') <> 'manual';
