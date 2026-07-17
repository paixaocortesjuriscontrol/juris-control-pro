
CREATE INDEX IF NOT EXISTS idx_pub_djen_coord_data_pub
  ON public.publicacoes_djen (coordenacao_id, data_publicacao DESC)
  WHERE data_publicacao IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_execucoes_agendadas_tipo_iniciado
  ON public.execucoes_agendadas (tipo, iniciado_em DESC)
  WHERE iniciado_em IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_execucoes_servidor_status_iniciado
  ON public.execucoes_servidor (status, iniciado_em DESC)
  WHERE iniciado_em IS NOT NULL;
