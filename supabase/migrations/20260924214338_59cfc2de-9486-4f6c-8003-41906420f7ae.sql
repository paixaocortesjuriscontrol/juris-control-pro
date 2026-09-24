DO $$
DECLARE f text; d text;
BEGIN
  FOREACH f IN ARRAY ARRAY['get_inteligencia_dashboard','get_inteligencia_ofensores','get_inteligencia_judit','get_inteligencia_oportunidades_acordo'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=f;
    d := replace(d, 'b.coordenacao_id = p_coordenacao_id', 'p_coordenacao_id = ''b0f690ad-68da-43d7-af5f-9adafeab3fd5''::uuid');
    d := replace(d, 't.coordenacao_id = p_coordenacao_id', 'p_coordenacao_id = ''b0f690ad-68da-43d7-af5f-9adafeab3fd5''::uuid');
    EXECUTE d;
  END LOOP;
END $$;