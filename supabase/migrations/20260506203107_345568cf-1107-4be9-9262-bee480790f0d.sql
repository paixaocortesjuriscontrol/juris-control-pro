ALTER TABLE public.execucoes_agendadas
  DROP CONSTRAINT IF EXISTS execucoes_agendadas_tipo_check;

ALTER TABLE public.execucoes_agendadas
  ADD CONSTRAINT execucoes_agendadas_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'redistribuicoes','andamentos','distribuicoes',
    'djen','djen_processos','termos','datajud_termos',
    'djen_pro','djen_flash','djen_paralela',
    'stf','stf_flash','djet_pautas'
  ]));