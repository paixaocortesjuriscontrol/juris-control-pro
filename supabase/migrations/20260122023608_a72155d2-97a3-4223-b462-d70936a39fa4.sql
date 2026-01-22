-- Ativar monitoramento DJEN para todos os processos ativos da coordenação Dra. Janaina
UPDATE processos 
SET monitorar_djen = true
WHERE coordenacao_id = 'f73e8ee7-924c-4518-bbdc-62dd77df93a1'
  AND status = 'ativo'
  AND monitorar_djen = false;