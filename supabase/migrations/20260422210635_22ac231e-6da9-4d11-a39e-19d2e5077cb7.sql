-- Habilitar extensão pg_trgm para acelerar buscas ILIKE (substring search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índices GIN trigram para campos pesquisados via ILIKE em get_processos_paginados
CREATE INDEX IF NOT EXISTS idx_processos_numero_trgm
  ON public.processos USING gin (numero gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_processos_assunto_trgm
  ON public.processos USING gin (assunto gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_processos_polo_ativo_trgm
  ON public.processos USING gin (polo_ativo gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_processos_polo_passivo_trgm
  ON public.processos USING gin (polo_passivo gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clientes_nome_trgm
  ON public.clientes USING gin (nome gin_trgm_ops);

-- Atualizar estatísticas
ANALYZE public.processos;
ANALYZE public.clientes;