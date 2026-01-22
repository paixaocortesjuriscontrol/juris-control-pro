-- Escalonar horários dos monitoramentos para evitar concorrência e exaustão de recursos
-- Cada tipo roda em horário diferente na madrugada/manhã

UPDATE configuracoes_monitoramento 
SET 
  horarios_execucao = ARRAY['02:00']::text[],
  frequencia = 'diario'
WHERE tipo = 'andamentos' AND coordenacao_id IS NULL;

UPDATE configuracoes_monitoramento 
SET 
  horarios_execucao = ARRAY['03:30']::text[],
  frequencia = 'diario'
WHERE tipo = 'redistribuicoes' AND coordenacao_id IS NULL;

UPDATE configuracoes_monitoramento 
SET 
  horarios_execucao = ARRAY['05:00']::text[],
  frequencia = 'diario'
WHERE tipo = 'djen_processos' AND coordenacao_id IS NULL;

UPDATE configuracoes_monitoramento 
SET 
  horarios_execucao = ARRAY['06:30']::text[],
  frequencia = 'diario'
WHERE tipo = 'distribuicoes' AND coordenacao_id IS NULL;

UPDATE configuracoes_monitoramento 
SET 
  horarios_execucao = ARRAY['08:00']::text[],
  frequencia = 'diario'
WHERE tipo = 'djen' AND coordenacao_id IS NULL;

UPDATE configuracoes_monitoramento 
SET 
  horarios_execucao = ARRAY['09:00']::text[],
  frequencia = 'diario'
WHERE tipo = 'termos' AND coordenacao_id IS NULL;