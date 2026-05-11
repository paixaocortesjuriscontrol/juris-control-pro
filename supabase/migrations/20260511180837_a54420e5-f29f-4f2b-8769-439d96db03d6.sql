UPDATE public.dados_benner
SET
  aba_origem = COALESCE(NULLIF(aba_origem, ''), 'Resposta Santander'),
  coordenacao_id = COALESCE(coordenacao_id, '3e47fc83-3539-4fa7-9fcf-33825120e1b7'::uuid)
WHERE aba_origem IS NULL
  AND coordenacao_id IS NULL
  AND benner_atualizado IS TRUE
  AND tribunal = 'TST'
  AND dossie IS NOT NULL
  AND dossie <> ''
  AND created_at >= '2026-05-11 17:40:00+00'::timestamptz
  AND created_at <= '2026-05-11 18:10:00+00'::timestamptz;