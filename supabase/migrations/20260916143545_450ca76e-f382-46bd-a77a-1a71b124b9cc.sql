UPDATE public.dados_benner
SET sem_pendencia = true, pendencias_verificado_em = now()
WHERE status IN ('pronto_envio','planilhado','enviado')
  AND sem_pendencia IS NOT TRUE
  AND (processo_outro_escritorio IS TRUE OR segredo_justica IS TRUE OR cejusc IS TRUE OR acordo IS TRUE);