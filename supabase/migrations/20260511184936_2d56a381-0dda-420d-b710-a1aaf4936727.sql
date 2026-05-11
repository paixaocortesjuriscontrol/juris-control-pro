DELETE FROM public.dados_benner
WHERE coordenacao_id = '3e47fc83-3539-4fa7-9fcf-33825120e1b7'::uuid
  AND tribunal = 'TST'
  AND aba_origem = 'Resposta Santander'
  AND benner_atualizado IS TRUE
  AND COALESCE(judit_preenchido, false) IS FALSE
  AND created_at >= '2026-05-11 17:40:00+00'::timestamptz
  AND created_at <= '2026-05-11 18:10:00+00'::timestamptz;