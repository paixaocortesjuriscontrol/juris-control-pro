CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_pub_djen_coord_status_created
  ON public.publicacoes_djen (coordenacao_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pub_djen_proc_coord_status_created
  ON public.publicacoes_djen_processos (coordenacao_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoramentos_djen_termo_trgm
  ON public.monitoramentos_djen USING gin (termo_busca gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_processos_polo_ativo_trgm
  ON public.processos USING gin (polo_ativo gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_processos_polo_passivo_trgm
  ON public.processos USING gin (polo_passivo gin_trgm_ops);