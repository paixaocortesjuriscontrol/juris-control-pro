
-- Índices para acelerar os totalizadores da tela de Distribuição TST
CREATE INDEX IF NOT EXISTS idx_dados_benner_data_distribuicao_planilha
  ON public.dados_benner (data_distribuicao_planilha);

CREATE INDEX IF NOT EXISTS idx_dados_benner_aba_origem_data_dist
  ON public.dados_benner (aba_origem, data_distribuicao_planilha)
  WHERE aba_origem IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dados_benner_benner_atualizado
  ON public.dados_benner (benner_atualizado);

CREATE INDEX IF NOT EXISTS idx_dados_benner_transito_julgado
  ON public.dados_benner (transito_julgado)
  WHERE transito_julgado = true;

CREATE INDEX IF NOT EXISTS idx_dados_benner_situacao_processo
  ON public.dados_benner (lower(situacao_processo));

CREATE INDEX IF NOT EXISTS idx_dados_benner_provas_digitais
  ON public.dados_benner (lower(provas_digitais));

CREATE INDEX IF NOT EXISTS idx_dados_benner_status_pronto_envio
  ON public.dados_benner (status)
  WHERE status = 'pronto_envio';

CREATE INDEX IF NOT EXISTS idx_dados_benner_sem_turma
  ON public.dados_benner (id)
  WHERE turma IS NULL OR turma = '';

CREATE INDEX IF NOT EXISTS idx_dados_benner_dossie_trgm
  ON public.dados_benner USING gin (dossie gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_dados_benner_recorrente_trgm
  ON public.dados_benner USING gin (recorrente gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_dados_benner_reclamante_trgm
  ON public.dados_benner USING gin (reclamante gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_dados_benner_reclamada_trgm
  ON public.dados_benner USING gin (reclamada gin_trgm_ops);

-- Garante a extensão pg_trgm para índices de busca textual (ilike)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
