
-- Índices funcionais por dígitos do processo (acelera buscas com regexp_replace)
CREATE INDEX IF NOT EXISTS idx_pub_djen_processo_digits
  ON public.publicacoes_djen (regexp_replace(COALESCE(processo_numero, ''), '[^0-9]', '', 'g'))
  WHERE processo_numero IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pub_djen_proc_processo_digits
  ON public.publicacoes_djen_processos (regexp_replace(COALESCE(processo_numero, ''), '[^0-9]', '', 'g'))
  WHERE processo_numero IS NOT NULL;

-- Índices por data_publicacao e data_disponibilizacao (filtro por intervalo de datas)
CREATE INDEX IF NOT EXISTS idx_pub_djen_data_publicacao_desc
  ON public.publicacoes_djen (data_publicacao DESC NULLS LAST)
  WHERE data_publicacao IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pub_djen_data_disponibilizacao_desc
  ON public.publicacoes_djen (data_disponibilizacao DESC NULLS LAST)
  WHERE data_disponibilizacao IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pub_djen_proc_data_publicacao_desc
  ON public.publicacoes_djen_processos (data_publicacao DESC NULLS LAST)
  WHERE data_publicacao IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pub_djen_proc_data_disponibilizacao_desc
  ON public.publicacoes_djen_processos (data_disponibilizacao DESC NULLS LAST)
  WHERE data_disponibilizacao IS NOT NULL;

-- Índice trigram para acelerar ILIKE em processo_numero (formato livre)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_pub_djen_processo_numero_trgm
  ON public.publicacoes_djen USING gin (processo_numero gin_trgm_ops)
  WHERE processo_numero IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pub_djen_proc_processo_numero_trgm
  ON public.publicacoes_djen_processos USING gin (processo_numero gin_trgm_ops)
  WHERE processo_numero IS NOT NULL;

ANALYZE public.publicacoes_djen;
ANALYZE public.publicacoes_djen_processos;
