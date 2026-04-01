
CREATE TABLE public.distribuicoes_tst (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE NOT NULL,
  processo_numero TEXT NOT NULL,
  data_distribuicao DATE,
  aba_origem TEXT,
  dossie TEXT,
  equipe TEXT,
  reclamante TEXT,
  reclamada TEXT,
  relator TEXT,
  relator_favorabilidade TEXT,
  turma TEXT,
  turma_favorabilidade TEXT,
  parte_recorrente TEXT,
  tipo_recurso_reclamante TEXT,
  materias_recurso_reclamante TEXT,
  aparelhamento_reclamante TEXT,
  chance_exito_reclamante TEXT,
  tipo_recurso_banco TEXT,
  materias_recurso_banco TEXT,
  aparelhamento_banco TEXT,
  chance_exito_banco TEXT,
  honra TEXT,
  tema TEXT,
  execucao TEXT,
  midia_negativa TEXT,
  decisao_quarteirizado TEXT,
  recurso_terceiros TEXT,
  benner_atualizado BOOLEAN DEFAULT false,
  transito_julgado BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup by process
CREATE INDEX idx_distribuicoes_tst_processo_id ON public.distribuicoes_tst(processo_id);
CREATE INDEX idx_distribuicoes_tst_processo_numero ON public.distribuicoes_tst(processo_numero);

-- Unique constraint to avoid duplicate imports (same process + same distribution date + same sheet)
CREATE UNIQUE INDEX idx_distribuicoes_tst_dedup ON public.distribuicoes_tst(processo_numero, COALESCE(data_distribuicao, '1900-01-01'::date), COALESCE(aba_origem, ''));

-- RLS
ALTER TABLE public.distribuicoes_tst ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view distribuicoes_tst"
  ON public.distribuicoes_tst FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert distribuicoes_tst"
  ON public.distribuicoes_tst FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update distribuicoes_tst"
  ON public.distribuicoes_tst FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete distribuicoes_tst"
  ON public.distribuicoes_tst FOR DELETE TO authenticated USING (true);

-- Auto-update updated_at
CREATE TRIGGER update_distribuicoes_tst_updated_at
  BEFORE UPDATE ON public.distribuicoes_tst
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
