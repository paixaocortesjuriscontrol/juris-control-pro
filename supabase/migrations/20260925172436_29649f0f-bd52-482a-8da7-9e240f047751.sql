DO $migration$
DECLARE
  v_definition text;
  v_old text := '(v_search_digits IS NOT NULL AND regexp_replace(coalesce(p.numero,''''), ''\D'', '''', ''g'') ILIKE ''%'' || v_search_digits || ''%'')';
  v_new text := '(v_search_digits IS NOT NULL AND (
        regexp_replace(coalesce(p.numero,''''), ''\D'', '''', ''g'') ILIKE ''%'' || v_search_digits || ''%'' OR
        regexp_replace(coalesce(p.dossie_tst,''''), ''\D'', '''', ''g'') ILIKE ''%'' || v_search_digits || ''%'' OR
        regexp_replace(coalesce(p.pasta_cliente,''''), ''\D'', '''', ''g'') ILIKE ''%'' || v_search_digits || ''%'' OR
        regexp_replace(coalesce(p.pasta_fisica,''''), ''\D'', '''', ''g'') ILIKE ''%'' || v_search_digits || ''%''
      ))';
  v_occurrences integer;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_processos_paginados'
  LIMIT 1;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'Função get_processos_paginados não encontrada';
  END IF;

  v_definition := regexp_replace(
    v_definition,
    E'\\(v_search_digits IS NOT NULL AND regexp_replace\\(coalesce\\(p\\.numero,''''\\), ''[^'']+'', '''', ''g''\\) ILIKE ''%'' \\|\\| v_search_digits \\|\\| ''%''\\)',
    v_new,
    'g'
  );
  IF position('regexp_replace(coalesce(p.dossie_tst' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível atualizar a busca de números';
  END IF;
  EXECUTE v_definition;
END
$migration$;