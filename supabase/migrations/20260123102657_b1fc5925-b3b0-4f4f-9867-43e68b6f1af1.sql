-- Fix ghost executions: executions with status='executando' but finalizado_em is set
UPDATE public.execucoes_agendadas 
SET status = CASE 
  WHEN ultimo_erro IS NOT NULL THEN 'falhou'
  ELSE 'concluido'
END
WHERE status = 'executando' 
AND finalizado_em IS NOT NULL;

-- Also fix executions stuck for more than 30 minutes without progress
UPDATE public.execucoes_agendadas 
SET status = 'timeout',
    finalizado_em = COALESCE(finalizado_em, NOW())
WHERE status = 'executando' 
AND finalizado_em IS NULL
AND iniciado_em < NOW() - INTERVAL '30 minutes';