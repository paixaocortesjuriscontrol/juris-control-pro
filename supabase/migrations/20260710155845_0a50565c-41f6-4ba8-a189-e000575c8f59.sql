
-- 1) Table for per-coordenação detection/monitoring config
CREATE TABLE IF NOT EXISTS public.config_deteccao_coordenacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenacao_id UUID NOT NULL UNIQUE REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  detectar_audiencias BOOLEAN NOT NULL DEFAULT false,
  detectar_intimacoes BOOLEAN NOT NULL DEFAULT false,
  monitorar_andamentos BOOLEAN NOT NULL DEFAULT false,
  horarios_andamentos TIME[] NOT NULL DEFAULT '{}',
  monitorar_djen_termos BOOLEAN NOT NULL DEFAULT false,
  horarios_djen_termos TIME[] NOT NULL DEFAULT '{}',
  monitorar_djen_processos BOOLEAN NOT NULL DEFAULT false,
  horarios_djen_processos TIME[] NOT NULL DEFAULT '{}',
  monitorar_distribuicoes BOOLEAN NOT NULL DEFAULT false,
  horarios_distribuicoes TIME[] NOT NULL DEFAULT '{}',
  monitorar_redistribuicoes BOOLEAN NOT NULL DEFAULT false,
  horarios_redistribuicoes TIME[] NOT NULL DEFAULT '{}',
  monitorar_djet_pautas BOOLEAN NOT NULL DEFAULT false,
  horarios_djet_pautas TIME[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_deteccao_coordenacao TO authenticated;
GRANT ALL ON public.config_deteccao_coordenacao TO service_role;

ALTER TABLE public.config_deteccao_coordenacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read config deteccao"
  ON public.config_deteccao_coordenacao FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "Authenticated write config deteccao"
  ON public.config_deteccao_coordenacao FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update config deteccao"
  ON public.config_deteccao_coordenacao FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete config deteccao"
  ON public.config_deteccao_coordenacao FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER trg_config_deteccao_updated_at
  BEFORE UPDATE ON public.config_deteccao_coordenacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Seed defaults for existing coordenações (all OFF)
INSERT INTO public.config_deteccao_coordenacao (coordenacao_id)
  SELECT id FROM public.coordenacoes
  ON CONFLICT (coordenacao_id) DO NOTHING;

-- 3) Auto-create default row when a new coordenação is created
CREATE OR REPLACE FUNCTION public.criar_config_deteccao_padrao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.config_deteccao_coordenacao (coordenacao_id)
  VALUES (NEW.id)
  ON CONFLICT (coordenacao_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_criar_config_deteccao ON public.coordenacoes;
CREATE TRIGGER trg_criar_config_deteccao
  AFTER INSERT ON public.coordenacoes
  FOR EACH ROW EXECUTE FUNCTION public.criar_config_deteccao_padrao();

-- 4) Helper function: resolve coordenacao for an audiência/intimação row
CREATE OR REPLACE FUNCTION public.resolver_coord_processo(p_processo_id UUID, p_processo_numero TEXT)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT coordenacao_id FROM public.processos WHERE id = p_processo_id LIMIT 1),
    (SELECT coordenacao_id FROM public.processos WHERE numero = p_processo_numero LIMIT 1)
  );
$$;

-- 5) BEFORE INSERT trigger on audiencias_detectadas: block if coord has detection OFF
CREATE OR REPLACE FUNCTION public.bloquear_audiencia_automatica()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_coord UUID;
  v_permitido BOOLEAN;
BEGIN
  -- Manual/import origins always pass through
  IF NEW.origem IS NULL OR NEW.origem IN ('manual', 'importacao', 'importado') THEN
    RETURN NEW;
  END IF;

  v_coord := COALESCE(NEW.coordenacao_id, public.resolver_coord_processo(NEW.processo_id, NEW.processo_numero));

  -- If no coordenação found, allow (orphan data)
  IF v_coord IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT detectar_audiencias INTO v_permitido
  FROM public.config_deteccao_coordenacao
  WHERE coordenacao_id = v_coord;

  IF v_permitido IS DISTINCT FROM TRUE THEN
    -- silently drop the insertion
    RETURN NULL;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bloquear_audiencia_automatica ON public.audiencias_detectadas;
CREATE TRIGGER trg_bloquear_audiencia_automatica
  BEFORE INSERT ON public.audiencias_detectadas
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_audiencia_automatica();

-- 6) BEFORE INSERT trigger on intimacoes_detectadas
CREATE OR REPLACE FUNCTION public.bloquear_intimacao_automatica()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_coord UUID;
  v_permitido BOOLEAN;
BEGIN
  IF NEW.origem IS NULL OR NEW.origem IN ('manual', 'importacao', 'importado') THEN
    RETURN NEW;
  END IF;

  v_coord := public.resolver_coord_processo(NEW.processo_id, NEW.processo_numero);
  IF v_coord IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT detectar_intimacoes INTO v_permitido
  FROM public.config_deteccao_coordenacao
  WHERE coordenacao_id = v_coord;

  IF v_permitido IS DISTINCT FROM TRUE THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bloquear_intimacao_automatica ON public.intimacoes_detectadas;
CREATE TRIGGER trg_bloquear_intimacao_automatica
  BEFORE INSERT ON public.intimacoes_detectadas
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_intimacao_automatica();
