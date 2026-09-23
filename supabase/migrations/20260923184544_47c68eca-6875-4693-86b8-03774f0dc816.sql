DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('public.desfazer_descarte_individual(uuid)'::regprocedure);
  v_def := replace(v_def,
    E'  IF v_tipo = ''termo'' THEN\n    INSERT INTO public.publicacoes_djen (',
    E'  BEGIN\n  IF v_tipo = ''termo'' THEN\n    INSERT INTO public.publicacoes_djen (');
  v_def := replace(v_def,
    E'    RAISE EXCEPTION ''Tipo de origem desconhecido: %'', v_tipo;\n  END IF;\n',
    E'    RAISE EXCEPTION ''Tipo de origem desconhecido: %'', v_tipo;\n  END IF;\n  EXCEPTION WHEN unique_violation THEN\n    v_restaurado := COALESCE(v_tipo, ''termo'') || ''_ja_existente'';\n  END;\n');
  IF position('unique_violation' in v_def) = 0 THEN
    RAISE EXCEPTION 'patch não aplicado';
  END IF;
  EXECUTE v_def;
END
$mig$;