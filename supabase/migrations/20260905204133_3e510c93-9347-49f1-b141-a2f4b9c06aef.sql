DO $do$
DECLARE
  r record;
  src text;
  anchor text := 'FROM public.dados_benner db
    WHERE db.aba_origem IS NOT NULL';
  repl text := 'FROM public.dados_benner db
    WHERE db.aba_origem IS NOT NULL
      AND (
        NULLIF(filters->>''semPendencia'','''') IS NULL OR filters->>''semPendencia'' = ''todos''
        OR (filters->>''semPendencia'' = ''sem'' AND db.sem_pendencia IS TRUE)
        OR (filters->>''semPendencia'' = ''com'' AND db.status IN (''pronto_envio'',''planilhado'',''enviado'') AND db.sem_pendencia IS DISTINCT FROM true)
      )
      AND (
        NULLIF(filters->>''revisarListaMaterias'','''') IS NULL OR filters->>''revisarListaMaterias'' = ''todos''
        OR (filters->>''revisarListaMaterias'' = ''sim'' AND db.revisar_lista_materias IS TRUE)
      )';
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_distribuicao_tst_stats','get_distribuicao_tst_situacao_totais','get_distribuicao_tst_responsaveis_counts')
  LOOP
    src := pg_get_functiondef(r.oid);
    IF position('semPendencia' in src) > 0 THEN CONTINUE; END IF;
    IF position(anchor in src) = 0 THEN
      RAISE EXCEPTION 'anchor not found in function %', r.oid;
    END IF;
    src := replace(src, anchor, repl);
    EXECUTE src;
  END LOOP;
END
$do$;