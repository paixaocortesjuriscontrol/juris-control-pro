CREATE TABLE IF NOT EXISTS public.processos_coordenacoes_responsaveis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  coordenacao_id uuid NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  principal boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT processos_coordenacoes_responsaveis_uq UNIQUE (processo_id, coordenacao_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.processos_coordenacoes_responsaveis TO authenticated;
GRANT ALL ON public.processos_coordenacoes_responsaveis TO service_role;

ALTER TABLE public.processos_coordenacoes_responsaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcr_select_ativos" ON public.processos_coordenacoes_responsaveis
  FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

CREATE POLICY "pcr_insert" ON public.processos_coordenacoes_responsaveis
  FOR INSERT TO authenticated WITH CHECK (public.is_user_active(auth.uid()));

CREATE POLICY "pcr_update" ON public.processos_coordenacoes_responsaveis
  FOR UPDATE TO authenticated USING (public.is_user_active(auth.uid()));

CREATE POLICY "pcr_delete" ON public.processos_coordenacoes_responsaveis
  FOR DELETE TO authenticated USING (public.is_user_active(auth.uid()));

CREATE INDEX IF NOT EXISTS pcr_processo_idx ON public.processos_coordenacoes_responsaveis(processo_id);
CREATE INDEX IF NOT EXISTS pcr_coordenacao_idx ON public.processos_coordenacoes_responsaveis(coordenacao_id);

CREATE TRIGGER update_pcr_updated_at BEFORE UPDATE ON public.processos_coordenacoes_responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill: coordenação atual de cada processo
INSERT INTO public.processos_coordenacoes_responsaveis (processo_id, coordenacao_id, principal)
SELECT p.id, p.coordenacao_id, true
FROM public.processos p
WHERE p.coordenacao_id IS NOT NULL
ON CONFLICT (processo_id, coordenacao_id) DO NOTHING;

-- Vínculo automático ao criar processo com coordenação
CREATE OR REPLACE FUNCTION public.sync_processo_coordenacao_responsavel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.coordenacao_id IS NOT NULL THEN
    INSERT INTO public.processos_coordenacoes_responsaveis (processo_id, coordenacao_id, principal)
    VALUES (NEW.id, NEW.coordenacao_id, true)
    ON CONFLICT (processo_id, coordenacao_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_processo_coordenacao_responsavel ON public.processos;
CREATE TRIGGER trg_sync_processo_coordenacao_responsavel
  AFTER INSERT OR UPDATE OF coordenacao_id ON public.processos
  FOR EACH ROW EXECUTE FUNCTION public.sync_processo_coordenacao_responsavel();

-- Coordenação deixa de ser chave de unicidade
DROP INDEX IF EXISTS public.processos_numero_coordenacao_uidx;

-- Visibilidade global de processos
DROP POLICY IF EXISTS processos_select_scoped ON public.processos;
CREATE POLICY processos_select_scoped ON public.processos
  FOR SELECT TO authenticated
  USING (
    public.is_user_active(auth.uid())
    OR cliente_id IN (
      SELECT cu.cliente_id FROM public.clientes_usuarios cu
      WHERE cu.user_id = auth.uid() AND cu.ativo = true
    )
  );