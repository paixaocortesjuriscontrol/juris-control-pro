-- Forçar cancelamento IMEDIATO - mantendo cancelado=true para a função parar
UPDATE configuracoes_monitoramento
SET 
  ativo = false,
  metadata = jsonb_build_object(
    'status', 'cancelando',
    'cancelado', true,
    'paused_globally', true,
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