
-- Adicionar coluna monitorar_djen na tabela processos
ALTER TABLE processos 
ADD COLUMN IF NOT EXISTS monitorar_djen boolean DEFAULT false;

-- Criar índice para performance nas buscas
CREATE INDEX IF NOT EXISTS idx_processos_monitorar_djen 
ON processos(monitorar_djen) WHERE monitorar_djen = true;

-- Comentário explicativo
COMMENT ON COLUMN processos.monitorar_djen IS 'Indica se o processo deve ser monitorado no DJEN (Diário de Justiça Eletrônico)';
