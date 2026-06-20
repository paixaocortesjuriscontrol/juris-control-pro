CREATE INDEX IF NOT EXISTS idx_pub_djen_servidor_data_dispo
  ON public.publicacoes_djen_servidor (data_disponibilizacao DESC);

CREATE INDEX IF NOT EXISTS idx_pub_djen_servidor_coord_data_dispo
  ON public.publicacoes_djen_servidor (coordenacao_id, data_disponibilizacao DESC);

CREATE INDEX IF NOT EXISTS idx_pub_djen_servidor_tipo_pub_data_dispo
  ON public.publicacoes_djen_servidor (tipo_publicacao, data_disponibilizacao DESC)
  WHERE tipo_publicacao IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pub_djen_servidor_monit_data_dispo
  ON public.publicacoes_djen_servidor (monitoramento_id, data_disponibilizacao DESC);

ANALYZE public.publicacoes_djen_servidor;