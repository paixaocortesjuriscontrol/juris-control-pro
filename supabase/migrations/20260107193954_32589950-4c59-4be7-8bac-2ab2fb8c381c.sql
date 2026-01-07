-- Criar tabela de alertas por parcela
CREATE TABLE public.alertas_parcela (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parcela_id UUID NOT NULL REFERENCES public.parcelas_evento(id) ON DELETE CASCADE,
  minutos_antes INTEGER NOT NULL DEFAULT 0,
  enviado BOOLEAN DEFAULT false,
  enviado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para buscar alertas pendentes
CREATE INDEX idx_alertas_parcela_enviado ON public.alertas_parcela(enviado) WHERE enviado = false OR enviado IS NULL;

-- RLS
ALTER TABLE public.alertas_parcela ENABLE ROW LEVEL SECURITY;

-- Política de leitura: mesmo acesso que os eventos pai
CREATE POLICY "Alertas parcela podem ser lidos por usuários autenticados"
  ON public.alertas_parcela
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parcelas_evento pe
      JOIN public.eventos_agenda ea ON ea.id = pe.evento_id
      WHERE pe.id = alertas_parcela.parcela_id
      AND can_access_evento(auth.uid(), ea.id)
    )
  );

-- Política de inserção
CREATE POLICY "Alertas parcela podem ser criados por usuários autenticados"
  ON public.alertas_parcela
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política de atualização
CREATE POLICY "Alertas parcela podem ser atualizados"
  ON public.alertas_parcela
  FOR UPDATE
  TO authenticated
  USING (true);

-- Política de deleção
CREATE POLICY "Alertas parcela podem ser deletados"
  ON public.alertas_parcela
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parcelas_evento pe
      JOIN public.eventos_agenda ea ON ea.id = pe.evento_id
      WHERE pe.id = alertas_parcela.parcela_id
      AND can_manage_evento(auth.uid(), ea.id)
    )
  );