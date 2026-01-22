-- Corrigir execuções "fantasma" que mostram 92% mesmo tendo finalizado
-- Atualiza todos os registros que estão como 'executando' mas já têm finalizado_em preenchido
UPDATE execucoes_agendadas 
SET status = 'timeout'
WHERE status = 'executando' 
AND finalizado_em IS NOT NULL;

-- Também cancelar execuções "executando" muito antigas (mais de 2 horas) que são fantasmas
UPDATE execucoes_agendadas 
SET status = 'timeout',
    finalizado_em = COALESCE(finalizado_em, now())
WHERE status = 'executando' 
AND iniciado_em < now() - interval '2 hours';