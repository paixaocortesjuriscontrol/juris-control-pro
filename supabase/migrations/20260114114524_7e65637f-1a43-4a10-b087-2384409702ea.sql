-- Tabela principal de execuções (runs) do monitoramento DJEN
CREATE TABLE public.djen_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL UNIQUE,
  iniciado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finalizado_em TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluido', 'erro', 'vazio_reexecutando')),
  total_monitoramentos INTEGER DEFAULT 0,
  processados INTEGER DEFAULT 0,
  novas INTEGER DEFAULT 0,
  descartadas INTEGER DEFAULT 0,
  duplicatas INTEGER DEFAULT 0,
  erros INTEGER DEFAULT 0,
  total_paginas INTEGER DEFAULT 0,
  total_resultados INTEGER DEFAULT 0,
  duracao_segundos INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  motivo_erro TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de lotes (batches) por execução
CREATE TABLE public.djen_lotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.djen_runs(run_id) ON DELETE CASCADE,
  lote_numero INTEGER NOT NULL,
  offset_inicial INTEGER NOT NULL,
  offset_final INTEGER NOT NULL,
  iniciado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finalizado_em TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluido', 'erro')),
  processados INTEGER DEFAULT 0,
  novas INTEGER DEFAULT 0,
  descartadas INTEGER DEFAULT 0,
  duplicatas INTEGER DEFAULT 0,
  erros INTEGER DEFAULT 0,
  total_paginas INTEGER DEFAULT 0,
  total_resultados INTEGER DEFAULT 0,
  duracao_segundos INTEGER DEFAULT 0,
  erro_mensagem TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de estatísticas por tribunal por lote
CREATE TABLE public.djen_tribunais_lote (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id UUID NOT NULL REFERENCES public.djen_lotes(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.djen_runs(run_id) ON DELETE CASCADE,
  tribunal TEXT NOT NULL,
  termos_buscados INTEGER DEFAULT 0,
  paginas INTEGER DEFAULT 0,
  resultados INTEGER DEFAULT 0,
  novas INTEGER DEFAULT 0,
  descartadas INTEGER DEFAULT 0,
  duplicatas INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para consultas eficientes
CREATE INDEX idx_djen_runs_iniciado_em ON public.djen_runs(iniciado_em DESC);
CREATE INDEX idx_djen_runs_status ON public.djen_runs(status);
CREATE INDEX idx_djen_lotes_run_id ON public.djen_lotes(run_id);
CREATE INDEX idx_djen_lotes_status ON public.djen_lotes(status);
CREATE INDEX idx_djen_tribunais_lote_run_id ON public.djen_tribunais_lote(run_id);
CREATE INDEX idx_djen_tribunais_lote_tribunal ON public.djen_tribunais_lote(tribunal);

-- Enable RLS
ALTER TABLE public.djen_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.djen_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.djen_tribunais_lote ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura para usuários autenticados (democratização de visibilidade)
CREATE POLICY "Usuários autenticados podem ver runs DJEN"
ON public.djen_runs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem ver lotes DJEN"
ON public.djen_lotes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem ver tribunais por lote DJEN"
ON public.djen_tribunais_lote FOR SELECT
TO authenticated
USING (true);

-- Políticas de inserção/update apenas para service role (edge functions)
CREATE POLICY "Service role pode inserir runs DJEN"
ON public.djen_runs FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role pode atualizar runs DJEN"
ON public.djen_runs FOR UPDATE
TO service_role
USING (true);

CREATE POLICY "Service role pode inserir lotes DJEN"
ON public.djen_lotes FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role pode atualizar lotes DJEN"
ON public.djen_lotes FOR UPDATE
TO service_role
USING (true);

CREATE POLICY "Service role pode inserir tribunais lote DJEN"
ON public.djen_tribunais_lote FOR INSERT
TO service_role
WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE public.djen_runs IS 'Registro de cada execução completa do monitoramento DJEN';
COMMENT ON TABLE public.djen_lotes IS 'Registro de cada lote (batch) processado durante uma run DJEN';
COMMENT ON TABLE public.djen_tribunais_lote IS 'Estatísticas por tribunal em cada lote processado';