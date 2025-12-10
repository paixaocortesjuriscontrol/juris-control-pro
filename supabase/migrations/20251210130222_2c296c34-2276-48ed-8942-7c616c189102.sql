-- Criar tabela para histórico de execuções do monitoramento
CREATE TABLE public.historico_monitoramento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo VARCHAR NOT NULL,
  processos_verificados INTEGER NOT NULL DEFAULT 0,
  novos_andamentos INTEGER NOT NULL DEFAULT 0,
  processos_com_novos INTEGER NOT NULL DEFAULT 0,
  erros INTEGER NOT NULL DEFAULT 0,
  detalhes JSONB,
  executado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.historico_monitoramento ENABLE ROW LEVEL SECURITY;

-- Admins e coordenadores podem ver histórico
CREATE POLICY "Admins podem ver histórico de monitoramento"
ON public.historico_monitoramento
FOR SELECT
USING (is_admin_or_coordenador(auth.uid()));

-- Sistema pode inserir histórico
CREATE POLICY "Sistema pode inserir histórico"
ON public.historico_monitoramento
FOR INSERT
WITH CHECK (true);

-- Índice para consultas por tipo e data
CREATE INDEX idx_historico_monitoramento_tipo_data ON public.historico_monitoramento(tipo, executado_em DESC);