UPDATE public.dados_benner
SET processo = regexp_replace(processo, '[^0-9./-]', '', 'g')
WHERE tribunal = 'TST'
  AND benner_atualizado IS TRUE
  AND coordenacao_id = '3e47fc83-3539-4fa7-9fcf-33825120e1b7'::uuid
  AND processo IS NOT NULL
  AND processo ~ '[^0-9./-]';