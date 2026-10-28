DO $migration$
DECLARE
  f record;
  original text;
  corrected text;
  replacements integer := 0;
BEGIN
  FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_djen_stats_per_user'
  LOOP
    original := pg_get_functiondef(f.oid);
    corrected := replace(original, 'COALESCE(md.coordenacao_id, pd.coordenacao_id)', 'COALESCE(pd.coordenacao_id, md.coordenacao_id)');
    -- Keep the content-key fallback identical to the listing RPC; only change effective scope.
    corrected := replace(corrected, 'public.compute_djen_conteudo_dedup_key(COALESCE(pd.coordenacao_id, md.coordenacao_id)', 'public.compute_djen_conteudo_dedup_key(COALESCE(md.coordenacao_id, pd.coordenacao_id)');
    IF corrected <> original THEN
      EXECUTE corrected;
      replacements := replacements + 1;
    END IF;
  END LOOP;
  IF replacements <> 2 THEN
    RAISE EXCEPTION 'Expected two statistics overloads to be corrected, got %', replacements;
  END IF;
END
$migration$;