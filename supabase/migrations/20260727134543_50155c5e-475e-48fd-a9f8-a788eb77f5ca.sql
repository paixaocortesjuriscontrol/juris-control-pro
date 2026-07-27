UPDATE public.execucoes_servidor
SET status = 'cancelado',
    finalizado_em = COALESCE(finalizado_em, now()),
    erro = COALESCE(erro, 'Cancelado pelo usuário')
WHERE id = '855ac2e6-00af-4a56-acfd-4b7a14635e41'
  AND status IN ('pendente','executando','agendado');

UPDATE public.execucoes_servidor_falhas
SET status = 'abandonado',
    updated_at = now()
WHERE status = 'pendente'
  AND dia_brt = (now() AT TIME ZONE 'America/Sao_Paulo')::date;