-- Limpar processos e dados relacionados para reimportação
-- Usando TRUNCATE CASCADE para limpar dependências

BEGIN;

-- Desabilitar temporariamente triggers e FK checks para truncate eficiente
SET session_replication_role = replica;

-- Truncar tabelas relacionadas aos processos
TRUNCATE TABLE movimentacoes CASCADE;
TRUNCATE TABLE prazos CASCADE;
TRUNCATE TABLE documentos CASCADE;
TRUNCATE TABLE alertas_monitoramento CASCADE;
TRUNCATE TABLE processos CASCADE;
TRUNCATE TABLE pastas CASCADE;

-- Reabilitar triggers e FK checks
SET session_replication_role = DEFAULT;

COMMIT;