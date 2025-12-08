-- Delete all existing data (in correct order due to foreign keys)
DELETE FROM movimentacoes;
DELETE FROM prazos;
DELETE FROM documentos;
DELETE FROM processos;