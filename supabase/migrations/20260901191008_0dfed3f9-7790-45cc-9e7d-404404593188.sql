CREATE TABLE public.ocorrencias_recorrentes_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  origem TEXT NOT NULL CHECK (origem IN ('tarefa','evento')),
  item_id UUID NOT NULL,
  data_ocorrencia DATE NOT NULL,
  status TEXT NOT NULL,
  observacao TEXT,
  alterado_por UUID,
  concluido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (origem, item_id, data_ocorrencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocorrencias_recorrentes_status TO authenticated;
GRANT ALL ON public.ocorrencias_recorrentes_status TO service_role;

ALTER TABLE public.ocorrencias_recorrentes_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver baixas de ocorrencias"
ON public.ocorrencias_recorrentes_status FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados podem registrar baixas de ocorrencias"
ON public.ocorrencias_recorrentes_status FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados podem atualizar baixas de ocorrencias"
ON public.ocorrencias_recorrentes_status FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados podem remover baixas de ocorrencias"
ON public.ocorrencias_recorrentes_status FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_ocorrencias_rec_status_item ON public.ocorrencias_recorrentes_status (origem, item_id, data_ocorrencia);

CREATE TRIGGER trg_ocorrencias_rec_status_updated_at
BEFORE UPDATE ON public.ocorrencias_recorrentes_status
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();