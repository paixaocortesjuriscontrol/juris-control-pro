DO $do$
DECLARE
  r record;
  src text;
  anchor text := 'FROM public.dados_benner db
    WHERE db.aba_origem IS NOT NULL';
  repl text := 'FROM public.dados_benner db
    WHERE db.aba_origem IS NOT NULL
      AND (NOT (COALESCE(filters->''excluirSituacoes'', ''[]''::jsonb) ? ''cejusc'') OR db.cejusc IS DISTINCT FROM true)
      AND (NOT (COALESCE(filters->''excluirSituacoes'', ''[]''::jsonb) ? ''acordo'') OR db.acordo IS DISTINCT FROM true)
      AND (NOT (COALESCE(filters->''excluirSituacoes'', ''[]''::jsonb) ? ''segredo_justica'') OR db.segredo_justica IS DISTINCT FROM true)
      AND (NOT (COALESCE(filters->''excluirSituacoes'', ''[]''::jsonb) ? ''outro_escritorio'') OR db.processo_outro_escritorio IS DISTINCT FROM true)
      AND (NOT (COALESCE(filters->''excluirSituacoes'', ''[]''::jsonb) ? ''transito'') OR db.transito_julgado IS DISTINCT FROM true)';
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_distribuicao_tst_stats','get_distribuicao_tst_situacao_totais','get_distribuicao_tst_responsaveis_counts')
  LOOP
    src := pg_get_functiondef(r.oid);
    IF position('excluirSituacoes' in src) > 0 THEN CONTINUE; END IF;
    IF position(anchor in src) = 0 THEN
      RAISE EXCEPTION 'anchor not found in function %', r.oid;
    END IF;
    src := replace(src, anchor, repl);
    EXECUTE src;
  END LOOP;
END
$do$;