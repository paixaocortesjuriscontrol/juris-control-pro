UPDATE public.execucoes_agendadas
SET status = 'cancelado',
    finalizado_em = NOW(),
    detalhes = COALESCE(detalhes, '{}'::jsonb) || jsonb_build_object('cancelado_manualmente', true, 'cancelado_em', NOW())
WHERE id = '801384d3-1a80-4f1e-8113-acf8b5e6d945'
  AND status = 'executando';