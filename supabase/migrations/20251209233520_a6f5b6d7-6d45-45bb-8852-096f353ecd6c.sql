-- Delete all process-related data in correct order due to foreign key constraints
DELETE FROM comentarios_prazos;
DELETE FROM prazos;
DELETE FROM movimentacoes;
DELETE FROM documentos WHERE processo_id IS NOT NULL;
DELETE FROM processos;