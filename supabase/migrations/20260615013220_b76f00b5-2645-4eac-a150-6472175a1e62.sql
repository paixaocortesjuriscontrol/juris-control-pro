
-- =========================================================
-- DJEN SERVIDOR — Estrutura isolada (não toca o fluxo atual)
-- =========================================================

-- 1) Configurações
CREATE TABLE public.configuracoes_monitoramento_servidor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL UNIQUE,
  frequencia text NOT NULL DEFAULT 'diario',
  ativo boolean NOT NULL DEFAULT true,
  horarios_execucao text[] DEFAULT ARRAY[]::text[],
  ultima_execucao timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.configuracoes_monitoramento_servidor TO authenticated;
GRANT ALL ON public.configuracoes_monitoramento_servidor TO service_role;

ALTER TABLE public.configuracoes_monitoramento_servidor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem configs servidor"
  ON public.configuracoes_monitoramento_servidor FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role gerencia configs servidor"
  ON public.configuracoes_monitoramento_servidor FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 2) Fila de execuções
CREATE TABLE public.execucoes_servidor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  agendado_para timestamptz NOT NULL DEFAULT now(),
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  worker_id text,
  heartbeat_at timestamptz,
  payload jsonb DEFAULT '{}'::jsonb,
  resultado jsonb DEFAULT '{}'::jsonb,
  erro text,
  tentativas int NOT NULL DEFAULT 0,
  dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_execucoes_servidor_status ON public.execucoes_servidor(status, agendado_para);
CREATE INDEX idx_execucoes_servidor_worker ON public.execucoes_servidor(worker_id) WHERE worker_id IS NOT NULL;

GRANT SELECT ON public.execucoes_servidor TO authenticated;
GRANT ALL ON public.execucoes_servidor TO service_role;

ALTER TABLE public.execucoes_servidor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem execucoes servidor"
  ON public.execucoes_servidor FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role gerencia execucoes servidor"
  ON public.execucoes_servidor FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3) Workers
CREATE TABLE public.workers_servidor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id text NOT NULL UNIQUE,
  host text,
  status text NOT NULL DEFAULT 'idle',
  current_execucao_id uuid REFERENCES public.execucoes_servidor(id) ON DELETE SET NULL,
  current_tipo text,
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.workers_servidor TO authenticated;
GRANT ALL ON public.workers_servidor TO service_role;

ALTER TABLE public.workers_servidor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem workers servidor"
  ON public.workers_servidor FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role gerencia workers servidor"
  ON public.workers_servidor FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4) Publicações encontradas (mesmo formato de publicacoes_djen + origem)
CREATE TABLE public.publicacoes_djen_servidor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitoramento_id uuid NOT NULL,
  hash_conteudo text NOT NULL,
  data_publicacao timestamptz,
  data_disponibilizacao timestamptz,
  processo_numero text,
  conteudo text,
  fonte text,
  tribunal text,
  polo_ativo text,
  polo_passivo text,
  orgao text,
  tipo_comunicacao text,
  meio text,
  advogados_json jsonb,
  partes_json jsonb DEFAULT '[]'::jsonb,
  dedup_processo_digits text,
  dedup_data_ref date,
  dedup_head_norm text,
  dedup_key text,
  dedup_conteudo_key text,
  coordenacao_id uuid,
  tipo_publicacao text NOT NULL DEFAULT 'intimacao',
  id_djen text,
  kurier_login text,
  origem text NOT NULL DEFAULT 'servidor',
  execucao_id uuid REFERENCES public.execucoes_servidor(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_pub_djen_servidor_hash ON public.publicacoes_djen_servidor(monitoramento_id, hash_conteudo);
CREATE INDEX idx_pub_djen_servidor_data ON public.publicacoes_djen_servidor(data_publicacao);
CREATE INDEX idx_pub_djen_servidor_proc ON public.publicacoes_djen_servidor(dedup_processo_digits);
CREATE INDEX idx_pub_djen_servidor_coord ON public.publicacoes_djen_servidor(coordenacao_id);

GRANT SELECT ON public.publicacoes_djen_servidor TO authenticated;
GRANT ALL ON public.publicacoes_djen_servidor TO service_role;

ALTER TABLE public.publicacoes_djen_servidor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem publicacoes servidor"
  ON public.publicacoes_djen_servidor FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role gerencia publicacoes servidor"
  ON public.publicacoes_djen_servidor FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5) Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_servidor_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_cfg_servidor_upd BEFORE UPDATE ON public.configuracoes_monitoramento_servidor
  FOR EACH ROW EXECUTE FUNCTION public.tg_servidor_updated_at();
CREATE TRIGGER trg_exec_servidor_upd BEFORE UPDATE ON public.execucoes_servidor
  FOR EACH ROW EXECUTE FUNCTION public.tg_servidor_updated_at();
CREATE TRIGGER trg_wrk_servidor_upd BEFORE UPDATE ON public.workers_servidor
  FOR EACH ROW EXECUTE FUNCTION public.tg_servidor_updated_at();

-- 6) RPCs
CREATE OR REPLACE FUNCTION public.lease_proxima_execucao_servidor(
  p_worker_id text,
  p_tipos text[] DEFAULT NULL
)
RETURNS public.execucoes_servidor
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.execucoes_servidor;
BEGIN
  WITH next_job AS (
    SELECT id FROM public.execucoes_servidor
    WHERE status = 'pendente'
      AND agendado_para <= now()
      AND (p_tipos IS NULL OR tipo = ANY(p_tipos))
    ORDER BY agendado_para ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.execucoes_servidor e
     SET status = 'executando',
         worker_id = p_worker_id,
         iniciado_em = now(),
         heartbeat_at = now(),
         tentativas = e.tentativas + 1
   FROM next_job
  WHERE e.id = next_job.id
  RETURNING e.* INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.lease_proxima_execucao_servidor(text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lease_proxima_execucao_servidor(text, text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.reset_jobs_orfaos_servidor(
  p_timeout_minutes int DEFAULT 5
)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.execucoes_servidor
     SET status = 'pendente',
         worker_id = NULL,
         heartbeat_at = NULL,
         erro = COALESCE(erro,'') || E'\n[reset_orfao]'
   WHERE status = 'executando'
     AND (heartbeat_at IS NULL OR heartbeat_at < now() - make_interval(mins => p_timeout_minutes));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_jobs_orfaos_servidor(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_jobs_orfaos_servidor(int) TO service_role;

CREATE OR REPLACE FUNCTION public.enfileirar_execucao_servidor(
  p_tipo text,
  p_agendado_para timestamptz DEFAULT now(),
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key text;
  v_id uuid;
BEGIN
  v_key := p_tipo || '|' || to_char(date_trunc('hour', p_agendado_para) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24');
  INSERT INTO public.execucoes_servidor (tipo, agendado_para, payload, dedupe_key)
  VALUES (p_tipo, p_agendado_para, p_payload, v_key)
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enfileirar_execucao_servidor(text, timestamptz, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enfileirar_execucao_servidor(text, timestamptz, jsonb) TO service_role;

-- 7) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.execucoes_servidor;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workers_servidor;

-- 8) Seeds (3 configs iniciais, JÁ ATIVAS)
INSERT INTO public.configuracoes_monitoramento_servidor (tipo, frequencia, ativo, horarios_execucao)
VALUES
  ('djen_paralela_servidor', 'diario', true, ARRAY['07:30']),
  ('kurier_servidor',        '30min', true, ARRAY[]::text[]),
  ('djet_pautas_servidor',   'diario', true, ARRAY['10:30'])
ON CONFLICT (tipo) DO NOTHING;
