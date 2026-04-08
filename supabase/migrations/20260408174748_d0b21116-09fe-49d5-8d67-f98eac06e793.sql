
CREATE INDEX IF NOT EXISTS idx_dados_benner_status ON public.dados_benner (status);
CREATE INDEX IF NOT EXISTS idx_dados_benner_created_at ON public.dados_benner (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dados_benner_relator ON public.dados_benner (relator);
CREATE INDEX IF NOT EXISTS idx_dados_benner_dossie ON public.dados_benner (dossie);
CREATE INDEX IF NOT EXISTS idx_dados_benner_contrato ON public.dados_benner (contrato);
CREATE INDEX IF NOT EXISTS idx_dados_benner_turma ON public.dados_benner (turma);
CREATE INDEX IF NOT EXISTS idx_dados_benner_tipo_recurso ON public.dados_benner (tipo_recurso);
CREATE INDEX IF NOT EXISTS idx_dados_benner_coordenacao_id ON public.dados_benner (coordenacao_id);
CREATE INDEX IF NOT EXISTS idx_dados_benner_user_id ON public.dados_benner (user_id);
