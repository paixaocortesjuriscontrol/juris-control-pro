-- Tabela para rastrear execuções de monitoramentos agendados
CREATE TABLE IF NOT EXISTS public.execucoes_agendadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('redistribuicoes', 'andamentos', 'distribuicoes', 'djen', 'djen_processos', 'termos')),
  job_name TEXT,
  status TEXT NOT NULL DEFAULT 'iniciado' CHECK (status IN ('iniciado', 'executando', 'concluido', 'falhou', 'timeout', 'cancelado')),
  agendado_para TIMESTAMPTZ,
  iniciado_em TIMESTAMPTZ DEFAULT NOW(),
  finalizado_em TIMESTAMPTZ,
  lotes_processados INTEGER DEFAULT 0,
  total_lotes INTEGER,
  registros_processados INTEGER DEFAULT 0,
  registros_encontrados INTEGER DEFAULT 0,
  erros INTEGER DEFAULT 0,
  ultimo_erro TEXT,
  detalhes JSONB DEFAULT '{}',
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_execucoes_agendadas_tipo_status ON public.execucoes_agendadas(tipo, status);
CREATE INDEX IF NOT EXISTS idx_execucoes_agendadas_created_at ON public.execucoes_agendadas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execucoes_agendadas_status ON public.execucoes_agendadas(status);

-- RLS
ALTER TABLE public.execucoes_agendadas ENABLE ROW LEVEL SECURITY;

-- Apenas admins e coordenadores podem ver (usando user_roles)
CREATE POLICY "Admins podem ver execucoes" ON public.execucoes_agendadas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'coordenador'))
  );

-- Sistema pode inserir/atualizar (service_role)
CREATE POLICY "Sistema pode gerenciar execucoes" ON public.execucoes_agendadas
  FOR ALL USING (auth.role() = 'service_role');

-- Função para limpar execuções antigas (manter últimos 30 dias)
CREATE OR REPLACE FUNCTION public.limpar_execucoes_antigas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.execucoes_agendadas
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;