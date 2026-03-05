
-- Índice em monitoramentos_djen para acelerar JOIN por coordenação
CREATE INDEX IF NOT EXISTS idx_monitoramentos_djen_coordenacao
  ON public.monitoramentos_djen (coordenacao_id);

-- Índice composto cobrindo os filtros principais da RPC (coordenação via monitoramento + lida + data)
CREATE INDEX IF NOT EXISTS idx_pub_djen_monit_lida_created
  ON public.publicacoes_djen (monitoramento_id, lida, created_at DESC);

-- Índice para publicacoes_djen_processos: processo_id + lida + created_at
CREATE INDEX IF NOT EXISTS idx_pub_djen_proc_procid_lida_created
  ON public.publicacoes_djen_processos (processo_id, lida, created_at DESC);

-- Índice em processos por coordenacao_id (usado no JOIN da RPC)
CREATE INDEX IF NOT EXISTS idx_processos_coordenacao
  ON public.processos (coordenacao_id);
