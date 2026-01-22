-- Corrigir runs órfãs/travadas do DJEN
UPDATE djen_runs 
SET status = 'cancelado', finalizado_em = now()
WHERE status = 'em_andamento' AND finalizado_em IS NULL;

-- Limpar execuções agendadas travadas
UPDATE execucoes_agendadas 
SET status = 'cancelado', finalizado_em = now()
WHERE tipo = 'djen' AND status IN ('executando', 'pendente', 'agendado') AND finalizado_em IS NULL;