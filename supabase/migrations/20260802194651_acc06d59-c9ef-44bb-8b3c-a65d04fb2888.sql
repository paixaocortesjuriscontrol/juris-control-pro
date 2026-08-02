UPDATE public.notificacoes_fila
SET processado = true,
    processado_em = now(),
    ultimo_erro = 'Cancelado manualmente pelo usuário'
WHERE processado = false;