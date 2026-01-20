-- Cancel stuck run that was using slow/expensive Bright Data
UPDATE djen_runs 
SET status = 'cancelado', 
    motivo_erro = 'Cancelado - Bright Data removido por ser lento e caro', 
    finalizado_em = NOW() 
WHERE run_id = '3f3f0797-8ed7-4be9-88dd-87600a724441' 
AND status = 'em_andamento';

-- Clean up metadata to allow new runs
UPDATE configuracoes_monitoramento 
SET metadata = NULL 
WHERE tipo = 'djen';