-- Adicionar 'cancelado' como status válido
ALTER TABLE djen_runs DROP CONSTRAINT djen_runs_status_check;
ALTER TABLE djen_runs ADD CONSTRAINT djen_runs_status_check 
  CHECK (status IN ('em_andamento', 'concluido', 'erro', 'vazio_reexecutando', 'cancelado'));

-- Cancelar runs antigos que ficaram em_andamento
UPDATE djen_runs 
SET status = 'cancelado', 
    motivo_erro = 'Cancelado - run anterior obsoleto',
    finalizado_em = now()
WHERE status = 'em_andamento' 
  AND iniciado_em < now() - interval '10 minutes';

-- Limpar o metadata para próxima execução começar do zero
UPDATE configuracoes_monitoramento 
SET metadata = jsonb_set(
  metadata::jsonb, 
  '{djen_run}', 
  'null'::jsonb
)
WHERE tipo = 'djen';