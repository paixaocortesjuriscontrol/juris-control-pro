-- Reset TOTAL do metadata DJEN (sem tocar em cron jobs)

-- 1. Forçar reset TOTAL do metadata
UPDATE configuracoes_monitoramento
SET 
  ativo = false,
  metadata = jsonb_build_object(
    'status', 'idle',
    'cancelado', false,
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
    'has_more', false,
    'djen_run', null,
    'last_run', null
  ),
  updated_at = now()
WHERE tipo = 'djen';

-- 2. Limpar TODAS as execuções DJEN
DELETE FROM execucoes_agendadas WHERE tipo = 'djen';