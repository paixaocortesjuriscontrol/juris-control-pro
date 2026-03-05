
-- Índices para publicacoes_djen
CREATE INDEX IF NOT EXISTS idx_pub_djen_monitoramento_created
  ON public.publicacoes_djen (monitoramento_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pub_djen_created_desc
  ON public.publicacoes_djen (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pub_djen_nao_lidas
  ON public.publicacoes_djen (lida, created_at DESC)
  WHERE lida = false;

CREATE INDEX IF NOT EXISTS idx_pub_djen_processo_numero
  ON public.publicacoes_djen (processo_numero)
  WHERE processo_numero IS NOT NULL;

-- Índices para publicacoes_djen_processos
CREATE INDEX IF NOT EXISTS idx_pub_djen_proc_processo_created
  ON public.publicacoes_djen_processos (processo_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pub_djen_proc_created_desc
  ON public.publicacoes_djen_processos (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pub_djen_proc_nao_lidas
  ON public.publicacoes_djen_processos (lida, created_at DESC)
  WHERE lida = false;

-- Índices para publicacoes_djen_descartadas
CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_monitoramento_created
  ON public.publicacoes_djen_descartadas (monitoramento_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_created_desc
  ON public.publicacoes_djen_descartadas (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pub_djen_desc_nao_lidas
  ON public.publicacoes_djen_descartadas (lida, created_at DESC)
  WHERE lida = false;
