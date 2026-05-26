UPDATE public.dados_benner
SET analisado = true,
    analisado_em = COALESCE(analisado_em, now()),
    em_analise = false,
    em_analise_por = NULL,
    em_analise_em = NULL
WHERE status = 'pronto_envio'
  AND analisado = false;