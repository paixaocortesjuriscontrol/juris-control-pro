
-- Tabela de prazos TST (Kanban de prazos fatais)
CREATE TABLE public.prazos_tst (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coordenacao_id UUID REFERENCES public.coordenacoes(id) ON DELETE SET NULL,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  numero_processo TEXT,
  dossie TEXT,
  reu TEXT,
  autor TEXT,
  equipe TEXT,
  decisao TEXT,
  formulario TEXT,
  providencias TEXT,
  deposito_judicial TEXT,
  preparo TEXT,
  multa_custas TEXT,
  responsavel TEXT,
  data_fatal DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prazos_tst ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Authenticated users can view prazos_tst"
ON public.prazos_tst FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert prazos_tst"
ON public.prazos_tst FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update prazos_tst"
ON public.prazos_tst FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete prazos_tst"
ON public.prazos_tst FOR DELETE TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_prazos_tst_updated_at
BEFORE UPDATE ON public.prazos_tst
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for coordenacao filter
CREATE INDEX idx_prazos_tst_coordenacao ON public.prazos_tst(coordenacao_id);
CREATE INDEX idx_prazos_tst_data_fatal ON public.prazos_tst(data_fatal);
