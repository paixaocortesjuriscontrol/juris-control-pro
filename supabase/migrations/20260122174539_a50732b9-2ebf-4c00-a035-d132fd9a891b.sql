BEGIN;

-- 1) Cancelar qualquer execução ainda marcada como executando (inclusive inconsistentes)
UPDATE public.execucoes_agendadas
SET
  status = 'cancelado',
  finalizado_em = COALESCE(finalizado_em, NOW()),
  ultimo_erro = COALESCE(ultimo_erro, 'Cancelado manualmente (pausa geral)'),
  detalhes = COALESCE(detalhes, '{}'::jsonb)
            || jsonb_build_object(
              'forced_cancel', true,
              'cancelado_em', NOW(),
              'reason', 'pausa_geral'
            )
WHERE status = 'executando';

-- 2) Pausar TODOS os monitoramentos para impedir recomeço por agendamento
UPDATE public.configuracoes_monitoramento
SET
  ativo = false,
  metadata = jsonb_strip_nulls(
    COALESCE(metadata, '{}'::jsonb)
    || jsonb_build_object(
      'cancelado', true,
      'status', 'cancelado',
      'continuingRun', false,
      'cancelled_at', NOW(),
      'paused_globally', true
    )
  )
WHERE coordenacao_id IS NULL;

COMMIT;
