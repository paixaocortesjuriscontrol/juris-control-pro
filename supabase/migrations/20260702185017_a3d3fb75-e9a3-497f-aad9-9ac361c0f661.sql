DO $$
DECLARE con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.execucoes_agendadas'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%tipo%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.execucoes_agendadas DROP CONSTRAINT %I', con_name);
  END IF;
  ALTER TABLE public.execucoes_agendadas
    ADD CONSTRAINT execucoes_agendadas_tipo_check
    CHECK (tipo IN (
      'djen','djen_processos','djen_termos','djen_termos_pro','djen_termos_flash',
      'djen_termos_paralela','djen_paralela',
      'djet_pautas','djet_pautas_paralela','djet_pautas_servidor',
      'stf_termos','stf','stf_flash',
      'andamentos','redistribuicoes','distribuicoes','termos',
      'datajud_termos','djen_pro','djen_flash',
      'kurier','djen_kurier','djen_kurier_servidor'
    ));
END $$;