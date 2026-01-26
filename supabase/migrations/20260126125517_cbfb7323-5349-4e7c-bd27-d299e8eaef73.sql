
-- Reset do metadata e limpeza de execuções (sem mexer no cron)

-- 1. Limpar execuções DJEN
DELETE FROM execucoes_agendadas WHERE tipo = 'djen';

-- 2. Reset TOTAL do metadata com cancelado=true
UPDATE configuracoes_monitoramento
SET 
  ativo = false,
  metadata = jsonb_build_object(
    'status', 'idle',
    'cancelado', true,
    'paused_globally', false,
    'continuingRun', false,
    'next_offset', 0,
    'current', 0,
    'total', 0,
    'percentage', 0,
    'processados', 0,
    'novas', 0,
    'duplicatas', 0,
    'descartadas', 0,
    'erros', 0,
    'has_more', false
  ),
  updated_at = now()
WHERE tipo = 'djen';
