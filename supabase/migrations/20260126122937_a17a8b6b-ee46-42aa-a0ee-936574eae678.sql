
-- DESATIVAR cron jobs do DJEN (com proteção para não existentes)
DO $$
BEGIN
  -- Desagendar apenas se existir
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monitorar-djen-manha') THEN
    PERFORM cron.unschedule('monitorar-djen-manha');
  END IF;
  
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monitorar-djen-meio') THEN
    PERFORM cron.unschedule('monitorar-djen-meio');
  END IF;
  
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monitorar-djen-tarde') THEN
    PERFORM cron.unschedule('monitorar-djen-tarde');
  END IF;
END $$;

-- Cancelar execução DJEN atual
UPDATE execucoes_agendadas 
SET status = 'cancelado', finalizado_em = NOW()
WHERE tipo = 'djen' AND status IN ('executando', 'pendente', 'agendado');

-- Resetar metadata com zeros
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
    'djen_run', NULL,
    'last_run', NULL,
    'last_complete_run', NULL,
    'tribunais_stats', '[]'::jsonb,
    'total_paginas', 0,
    'total_resultados', 0,
    'duracao_s', 0,
    'offset_processado', 0
  )
WHERE tipo = 'djen';
