DO $migration$
DECLARE
  r record;
  definition text;
  old_line text := 'v_tribunal := NULLIF(regexp_replace(upper(COALESCE(p_tribunal, '''')), ''[^A-Z0-9]'', '''', ''g''), '''');';
  new_line text := 'v_tribunal := NULLIF(regexp_replace(upper(COALESCE(p_tribunal, '''')), ''[^A-Z0-9]'', '''', ''g''), '''');
  -- Kurier uses separated region names (TRT 3_DJEN / TRT - 3 REGIAO).
  -- Keep the existing token boundaries, so TRT3 never matches TRT13 or TRT30.
  IF v_tribunal ~ ''^(TRT|TRF)[0-9]+$'' THEN
    v_tribunal := regexp_replace(v_tribunal, ''^(TRT|TRF)([0-9]+)$'', ''\1[[:space:]-]*\2'');
  END IF;';
  changed integer := 0;
BEGIN
  FOR r IN SELECT p.oid, p.proname FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('get_djen_publicacoes_unificadas', 'get_djen_publicacoes_servidor_unificadas', 'get_djen_stats_per_user', 'get_djen_stats_servidor_per_user')
      AND 'p_tribunal' = ANY(p.proargnames)
  LOOP
    definition := pg_get_functiondef(r.oid);
    IF strpos(definition, old_line) = 0 THEN
      RAISE EXCEPTION 'Expected tribunal comparison not found in %', r.proname;
    END IF;
    EXECUTE replace(definition, old_line, new_line);
    changed := changed + 1;
  END LOOP;
  IF changed <> 4 THEN
    RAISE EXCEPTION 'Expected four tribunal-filter functions, found %', changed;
  END IF;
END;
$migration$;