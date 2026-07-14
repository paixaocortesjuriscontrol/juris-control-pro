ALTER TABLE public.publicacoes_djen
  ADD COLUMN IF NOT EXISTS processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL;

ALTER TABLE public.publicacoes_djen_descartadas
  ADD COLUMN IF NOT EXISTS processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_processo_id ON public.publicacoes_djen(processo_id);
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_descartadas_processo_id ON public.publicacoes_djen_descartadas(processo_id);