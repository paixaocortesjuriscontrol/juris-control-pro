-- Limpar registros de batches vazios (duração <= 1s) do monitoramento DJEN
DELETE FROM historico_monitoramento 
WHERE tipo = 'djen' 
AND (
  (detalhes->>'duracao_s')::int <= 1 
  OR processos_verificados = 0
)