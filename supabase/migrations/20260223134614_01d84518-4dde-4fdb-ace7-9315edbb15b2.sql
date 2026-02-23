-- Adicionar colunas estruturadas da API à tabela publicacoes_djen_processos
-- (mesmas colunas que já existem em publicacoes_djen para termos)

ALTER TABLE public.publicacoes_djen_processos
ADD COLUMN IF NOT EXISTS orgao text,
ADD COLUMN IF NOT EXISTS tipo_comunicacao text,
ADD COLUMN IF NOT EXISTS meio text,
ADD COLUMN IF NOT EXISTS advogados_json jsonb,
ADD COLUMN IF NOT EXISTS partes_json jsonb;

-- Comentários para documentação
COMMENT ON COLUMN public.publicacoes_djen_processos.orgao IS 'Órgão julgador da API PJE Comunica (nomeOrgao)';
COMMENT ON COLUMN public.publicacoes_djen_processos.tipo_comunicacao IS 'Tipo de comunicação da API (tipoComunicacao)';
COMMENT ON COLUMN public.publicacoes_djen_processos.meio IS 'Meio de comunicação da API (meio)';
COMMENT ON COLUMN public.publicacoes_djen_processos.advogados_json IS 'Advogados extraídos dos metadados estruturados da API (JSONB array de strings)';
COMMENT ON COLUMN public.publicacoes_djen_processos.partes_json IS 'Destinatários/partes extraídos dos metadados estruturados da API (JSONB array de strings)';