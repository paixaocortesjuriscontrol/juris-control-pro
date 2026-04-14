
-- Delete related data first
DELETE FROM tarefas WHERE processo_id IN (SELECT id FROM processos WHERE categoria_importacao = 'senai_sesi');
DELETE FROM movimentacoes WHERE processo_id IN (SELECT id FROM processos WHERE categoria_importacao = 'senai_sesi');
DELETE FROM documentos WHERE processo_id IN (SELECT id FROM processos WHERE categoria_importacao = 'senai_sesi');
DELETE FROM custas_processuais WHERE processo_id IN (SELECT id FROM processos WHERE categoria_importacao = 'senai_sesi');
DELETE FROM depositos_recursais WHERE processo_id IN (SELECT id FROM processos WHERE categoria_importacao = 'senai_sesi');
DELETE FROM audiencias_detectadas WHERE processo_id IN (SELECT id FROM processos WHERE categoria_importacao = 'senai_sesi');
DELETE FROM intimacoes_detectadas WHERE processo_id IN (SELECT id FROM processos WHERE categoria_importacao = 'senai_sesi');
DELETE FROM alertas_monitoramento WHERE processo_id IN (SELECT id FROM processos WHERE categoria_importacao = 'senai_sesi');
DELETE FROM distribuicoes_tst WHERE processo_id IN (SELECT id FROM processos WHERE categoria_importacao = 'senai_sesi');
DELETE FROM processos_responsaveis WHERE processo_id IN (SELECT id FROM processos WHERE categoria_importacao = 'senai_sesi');

-- Delete the processes
DELETE FROM processos WHERE categoria_importacao = 'senai_sesi';
