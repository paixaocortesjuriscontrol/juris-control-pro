-- Delete all processes from Dr. Jhonatan's coordination
-- First delete dependent records, then the processes
DELETE FROM alertas_monitoramento WHERE processo_id IN (SELECT id FROM processos WHERE coordenacao_id = '968631d0-6659-46f1-b45d-899892cb0121');
DELETE FROM movimentacoes WHERE processo_id IN (SELECT id FROM processos WHERE coordenacao_id = '968631d0-6659-46f1-b45d-899892cb0121');
DELETE FROM prazos WHERE processo_id IN (SELECT id FROM processos WHERE coordenacao_id = '968631d0-6659-46f1-b45d-899892cb0121');
DELETE FROM documentos WHERE processo_id IN (SELECT id FROM processos WHERE coordenacao_id = '968631d0-6659-46f1-b45d-899892cb0121');
DELETE FROM processos WHERE coordenacao_id = '968631d0-6659-46f1-b45d-899892cb0121';