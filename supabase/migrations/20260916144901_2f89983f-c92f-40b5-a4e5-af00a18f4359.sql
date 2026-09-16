UPDATE public.dados_benner
SET sem_pendencia = true,
    pendencias_verificado_em = now()
WHERE id IN (
  '4438f065-81b2-4baf-9a6a-b1788e812cb2'::uuid,
  '9a53117a-ec0f-4250-b116-9201cf1f5e86'::uuid
)
AND status IN ('pronto_envio', 'planilhado', 'enviado');