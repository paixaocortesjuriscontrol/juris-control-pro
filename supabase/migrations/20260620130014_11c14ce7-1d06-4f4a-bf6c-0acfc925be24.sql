CREATE INDEX IF NOT EXISTS idx_pub_djen_servidor_data_dispo_created
  ON public.publicacoes_djen_servidor (data_disponibilizacao DESC, created_at DESC)
  WHERE tipo_publicacao IS NULL OR tipo_publicacao <> 'descartada';

CREATE INDEX IF NOT EXISTS idx_pub_djen_servidor_created_at
  ON public.publicacoes_djen_servidor (created_at DESC)
  WHERE tipo_publicacao IS NULL OR tipo_publicacao <> 'descartada';

ANALYZE public.publicacoes_djen_servidor;