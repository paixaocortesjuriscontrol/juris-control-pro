-- Reaplicar limpeza de execuções "fantasma" (segurança: não deve existir executando com finalizado_em)
UPDATE public.execucoes_agendadas
SET status = 'timeout'
WHERE status = 'executando'
  AND finalizado_em IS NOT NULL;