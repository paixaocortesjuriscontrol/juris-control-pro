-- Adicionar coluna data_disponibilizacao nas tabelas de publicações DJEN
ALTER TABLE public.publicacoes_djen 
ADD COLUMN IF NOT EXISTS data_disponibilizacao timestamptz;

ALTER TABLE public.publicacoes_djen_processos 
ADD COLUMN IF NOT EXISTS data_disponibilizacao timestamptz;

-- Atualizar registros existentes: data_disponibilizacao = data_publicacao - 1 dia (padrão do DJEN)
UPDATE public.publicacoes_djen 
SET data_disponibilizacao = (data_publicacao::date - interval '1 day')::timestamptz
WHERE data_disponibilizacao IS NULL AND data_publicacao IS NOT NULL;

UPDATE public.publicacoes_djen_processos 
SET data_disponibilizacao = (data_publicacao::date - interval '1 day')::timestamptz
WHERE data_disponibilizacao IS NULL AND data_publicacao IS NOT NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.publicacoes_djen.data_disponibilizacao IS 'Data em que a publicação foi disponibilizada no sistema (geralmente D-1 da publicação oficial)';
COMMENT ON COLUMN public.publicacoes_djen.data_publicacao IS 'Data oficial da publicação no Diário de Justiça Eletrônico';

COMMENT ON COLUMN public.publicacoes_djen_processos.data_disponibilizacao IS 'Data em que a publicação foi disponibilizada no sistema (geralmente D-1 da publicação oficial)';
COMMENT ON COLUMN public.publicacoes_djen_processos.data_publicacao IS 'Data oficial da publicação no Diário de Justiça Eletrônico';