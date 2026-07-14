
-- =========================================================================
-- Fase 2: Configuração individual de notificações + fila de mudanças
-- =========================================================================

-- 1) Tabela de configuração por usuário --------------------------------------
CREATE TABLE IF NOT EXISTS public.config_notificacoes_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL UNIQUE,
  canal_email BOOLEAN NOT NULL DEFAULT true,
  canal_whatsapp BOOLEAN NOT NULL DEFAULT true,
  canal_in_app BOOLEAN NOT NULL DEFAULT true,
  evento_mudanca_situacao BOOLEAN NOT NULL DEFAULT true,
  evento_prazo_perdido BOOLEAN NOT NULL DEFAULT true,
  evento_tarefa_nova BOOLEAN NOT NULL DEFAULT true,
  evento_comentario BOOLEAN NOT NULL DEFAULT true,
  evento_reagendamento BOOLEAN NOT NULL DEFAULT true,
  janela_hora_inicio INTEGER NOT NULL DEFAULT 8 CHECK (janela_hora_inicio BETWEEN 0 AND 23),
  janela_hora_fim INTEGER NOT NULL DEFAULT 20 CHECK (janela_hora_fim BETWEEN 0 AND 23),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_notificacoes_usuario TO authenticated;
GRANT ALL ON public.config_notificacoes_usuario TO service_role;

ALTER TABLE public.config_notificacoes_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario_ve_propria_config" ON public.config_notificacoes_usuario
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "usuario_gerencia_propria_config" ON public.config_notificacoes_usuario
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- Trigger updated_at
CREATE TRIGGER trg_config_notif_usuario_updated
  BEFORE UPDATE ON public.config_notificacoes_usuario
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Fila de notificações pendentes ------------------------------------------
CREATE TABLE IF NOT EXISTS public.notificacoes_fila (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_evento TEXT NOT NULL, -- 'mudanca_situacao' | 'prazo_perdido' | 'reagendamento' | ...
  entidade TEXT NOT NULL,    -- 'tarefa' | 'evento' | 'audiencia' | 'parcela'
  entidade_id UUID NOT NULL,
  coordenacao_id UUID,
  status_anterior TEXT,
  status_novo TEXT,
  titulo TEXT,
  contexto JSONB DEFAULT '{}'::jsonb,
  responsaveis UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  processado BOOLEAN NOT NULL DEFAULT false,
  processado_em TIMESTAMPTZ,
  tentativas INTEGER NOT NULL DEFAULT 0,
  ultimo_erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_fila_pendentes
  ON public.notificacoes_fila (processado, created_at)
  WHERE processado = false;

GRANT SELECT ON public.notificacoes_fila TO authenticated;
GRANT ALL ON public.notificacoes_fila TO service_role;

ALTER TABLE public.notificacoes_fila ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_coord_veem_fila" ON public.notificacoes_fila
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

-- 3) Função para resolver responsáveis por entidade --------------------------
CREATE OR REPLACE FUNCTION public.resolver_responsaveis_entidade(
  _entidade TEXT,
  _entidade_id UUID
) RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF _entidade = 'tarefa' THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT usuario_id) FILTER (WHERE usuario_id IS NOT NULL), ARRAY[]::UUID[])
      INTO ids
    FROM public.tarefa_responsaveis WHERE tarefa_id = _entidade_id;
    IF COALESCE(array_length(ids, 1), 0) = 0 THEN
      SELECT COALESCE(ARRAY[responsavel_id], ARRAY[]::UUID[]) INTO ids
      FROM public.tarefas WHERE id = _entidade_id AND responsavel_id IS NOT NULL;
    END IF;
  ELSIF _entidade = 'evento' THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT usuario_id) FILTER (WHERE usuario_id IS NOT NULL), ARRAY[]::UUID[])
      INTO ids
    FROM public.evento_responsaveis WHERE evento_id = _entidade_id;
  ELSIF _entidade = 'audiencia' THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT usuario_id) FILTER (WHERE usuario_id IS NOT NULL), ARRAY[]::UUID[])
      INTO ids
    FROM public.audiencia_envolvidos WHERE audiencia_id = _entidade_id;
    IF COALESCE(array_length(ids, 1), 0) = 0 THEN
      SELECT COALESCE(ARRAY[criado_por], ARRAY[]::UUID[]) INTO ids
      FROM public.audiencias_detectadas WHERE id = _entidade_id AND criado_por IS NOT NULL;
    END IF;
  ELSIF _entidade = 'parcela' THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT er.usuario_id) FILTER (WHERE er.usuario_id IS NOT NULL), ARRAY[]::UUID[])
      INTO ids
    FROM public.parcelas_evento pe
    JOIN public.evento_responsaveis er ON er.evento_id = pe.evento_id
    WHERE pe.id = _entidade_id;
  END IF;
  RETURN COALESCE(ids, ARRAY[]::UUID[]);
END;
$$;

-- 4) Trigger genérico de mudança de status -----------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_mudanca_situacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entidade TEXT := TG_ARGV[0];
  _status_col TEXT := COALESCE(TG_ARGV[1], 'status');
  _status_ant TEXT;
  _status_novo TEXT;
  _titulo TEXT;
  _coord UUID;
  _resp UUID[];
BEGIN
  -- Extrai status dinâmico
  EXECUTE format('SELECT ($1).%I::TEXT, ($2).%I::TEXT', _status_col, _status_col)
    INTO _status_ant, _status_novo
    USING OLD, NEW;

  IF _status_ant IS NOT DISTINCT FROM _status_novo THEN
    RETURN NEW;
  END IF;

  -- Título e coordenação (best-effort)
  BEGIN
    EXECUTE format('SELECT ($1).titulo::TEXT', '') INTO _titulo USING NEW;
  EXCEPTION WHEN OTHERS THEN
    _titulo := NULL;
  END;

  BEGIN
    EXECUTE 'SELECT ($1).coordenacao_id::UUID' INTO _coord USING NEW;
  EXCEPTION WHEN OTHERS THEN
    _coord := NULL;
  END;

  _resp := public.resolver_responsaveis_entidade(_entidade, NEW.id);

  IF COALESCE(array_length(_resp, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notificacoes_fila (
    tipo_evento, entidade, entidade_id, coordenacao_id,
    status_anterior, status_novo, titulo, responsaveis
  ) VALUES (
    'mudanca_situacao', _entidade, NEW.id, _coord,
    _status_ant, _status_novo, _titulo, _resp
  );

  RETURN NEW;
END;
$$;

-- Anexar em tarefas, eventos_agenda, audiencias_detectadas, parcelas_evento
DROP TRIGGER IF EXISTS trg_notif_mudanca_tarefas ON public.tarefas;
CREATE TRIGGER trg_notif_mudanca_tarefas
  AFTER UPDATE OF status ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_mudanca_situacao('tarefa', 'status');

DROP TRIGGER IF EXISTS trg_notif_mudanca_eventos ON public.eventos_agenda;
CREATE TRIGGER trg_notif_mudanca_eventos
  AFTER UPDATE OF status ON public.eventos_agenda
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_mudanca_situacao('evento', 'status');

DROP TRIGGER IF EXISTS trg_notif_mudanca_audiencias ON public.audiencias_detectadas;
CREATE TRIGGER trg_notif_mudanca_audiencias
  AFTER UPDATE OF status ON public.audiencias_detectadas
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_mudanca_situacao('audiencia', 'status');

DROP TRIGGER IF EXISTS trg_notif_mudanca_parcelas ON public.parcelas_evento;
CREATE TRIGGER trg_notif_mudanca_parcelas
  AFTER UPDATE OF status ON public.parcelas_evento
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_mudanca_situacao('parcela', 'status');
