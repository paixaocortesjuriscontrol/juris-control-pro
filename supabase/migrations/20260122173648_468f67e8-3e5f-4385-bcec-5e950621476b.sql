-- Reset geral: cancelar qualquer execução marcada como 'executando' (showing stale/buggy state)

BEGIN;

-- 1) Cancelar todas as execuções em andamento (inclui casos inconsistentes com finalizado_em preenchido)
UPDATE public.execucoes_agendadas
SET
  status = 'cancelado',
  finalizado_em = COALESCE(finalizado_em, NOW()),
  ultimo_erro = COALESCE(ultimo_erro, 'Cancelado manualmente (reset geral)'),
  detalhes = COALESCE(detalhes, '{}'::jsonb)
            || jsonb_build_object(
              'forced_cancel', true,
              'cancelado_em', NOW()
            )
WHERE status = 'executando';

-- 2) Marcar configs como canceladas e interromper auto-continuação
UPDATE public.configuracoes_monitoramento
SET
  metadata = jsonb_strip_nulls(
    COALESCE(metadata, '{}'::jsonb)
    || jsonb_build_object(
      'cancelado', true,
      'status', 'cancelado',
      'continuingRun', false,
      'cancelled_at', NOW()
    )
  )
WHERE true;

COMMIT;
