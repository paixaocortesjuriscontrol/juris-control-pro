-- Delete related data first (foreign key constraints)
DELETE FROM movimentacoes WHERE processo_id IN (
  SELECT id FROM processos WHERE coordenacao_id = 'ec321093-4551-42e3-b84d-78993a38d216'
);

DELETE FROM prazos WHERE processo_id IN (
  SELECT id FROM processos WHERE coordenacao_id = 'ec321093-4551-42e3-b84d-78993a38d216'
);

DELETE FROM documentos WHERE processo_id IN (
  SELECT id FROM processos WHERE coordenacao_id = 'ec321093-4551-42e3-b84d-78993a38d216'
);

DELETE FROM alertas_monitoramento WHERE processo_id IN (
  SELECT id FROM processos WHERE coordenacao_id = 'ec321093-4551-42e3-b84d-78993a38d216'
);

-- Now delete the processes
DELETE FROM processos WHERE coordenacao_id = 'ec321093-4551-42e3-b84d-78993a38d216';