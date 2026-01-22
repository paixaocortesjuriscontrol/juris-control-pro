-- Tabela de parâmetros para monitoramento DJEN (configurável pelo usuário)
CREATE TABLE public.parametros_monitoramento_djen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Estratégia de processamento
  modo_processamento TEXT NOT NULL DEFAULT 'semi_paralelo' CHECK (modo_processamento IN ('sequencial', 'semi_paralelo', 'paralelo_total')),
  
  -- Controle de concorrência
  max_paralelo INTEGER NOT NULL DEFAULT 5 CHECK (max_paralelo >= 1 AND max_paralelo <= 20),
  max_por_invocacao INTEGER NOT NULL DEFAULT 10 CHECK (max_por_invocacao >= 1 AND max_por_invocacao <= 30),
  
  -- Delays em milissegundos
  delay_entre_monitoramentos INTEGER NOT NULL DEFAULT 1000 CHECK (delay_entre_monitoramentos >= 0 AND delay_entre_monitoramentos <= 10000),
  delay_entre_paginas INTEGER NOT NULL DEFAULT 500 CHECK (delay_entre_paginas >= 0 AND delay_entre_paginas <= 5000),
  delay_entre_tribunais INTEGER NOT NULL DEFAULT 300 CHECK (delay_entre_tribunais >= 0 AND delay_entre_tribunais <= 5000),
  delay_jina_api INTEGER NOT NULL DEFAULT 2000 CHECK (delay_jina_api >= 1000 AND delay_jina_api <= 10000),
  
  -- Timeouts
  soft_timeout_ms INTEGER NOT NULL DEFAULT 50000 CHECK (soft_timeout_ms >= 20000 AND soft_timeout_ms <= 120000),
  finalization_buffer_ms INTEGER NOT NULL DEFAULT 10000 CHECK (finalization_buffer_ms >= 5000 AND finalization_buffer_ms <= 30000),
  
  -- Retry config
  max_retries INTEGER NOT NULL DEFAULT 3 CHECK (max_retries >= 1 AND max_retries <= 10),
  retry_base_delay_ms INTEGER NOT NULL DEFAULT 2000 CHECK (retry_base_delay_ms >= 500 AND retry_base_delay_ms <= 10000),
  
  -- Metadata
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir configuração padrão (semi-paralelo otimizado)
INSERT INTO public.parametros_monitoramento_djen (
  modo_processamento,
  max_paralelo,
  max_por_invocacao,
  delay_entre_monitoramentos,
  delay_entre_paginas,
  delay_entre_tribunais,
  delay_jina_api,
  soft_timeout_ms,
  finalization_buffer_ms,
  max_retries,
  retry_base_delay_ms,
  descricao
) VALUES (
  'semi_paralelo',
  5,
  10,
  500,
  300,
  200,
  2000,
  50000,
  10000,
  3,
  2000,
  'Configuração padrão: semi-paralelo com 5 monitoramentos simultâneos'
);

-- Enable RLS
ALTER TABLE public.parametros_monitoramento_djen ENABLE ROW LEVEL SECURITY;

-- Política de leitura: todos autenticados podem ler
CREATE POLICY "Autenticados podem ler parâmetros DJEN" 
ON public.parametros_monitoramento_djen 
FOR SELECT 
TO authenticated
USING (true);

-- Política de escrita: todos autenticados podem modificar
CREATE POLICY "Autenticados podem modificar parâmetros DJEN" 
ON public.parametros_monitoramento_djen 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_parametros_djen_updated_at
BEFORE UPDATE ON public.parametros_monitoramento_djen
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();