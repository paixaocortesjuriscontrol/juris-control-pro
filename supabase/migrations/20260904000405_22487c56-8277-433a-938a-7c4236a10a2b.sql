DO $mig$
DECLARE d text; d2 text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d
  FROM pg_proc p
  WHERE p.oid::regprocedure::text = 'get_djen_stats_per_user(uuid,timestamp with time zone,timestamp with time zone,text,text,uuid,timestamp with time zone,timestamp with time zone,text)';

  IF d IS NULL THEN
    RAISE EXCEPTION 'funcao get_djen_stats_per_user nao encontrada';
  END IF;

  d2 := regexp_replace(
    d,
    'COALESCE\(\s*public\.compute_djen_conteudo_dedup_key\(COALESCE\(md\.coordenacao_id, pd\.coordenacao_id\)',
    'COALESCE(pd.dedup_conteudo_key, public.compute_djen_conteudo_dedup_key(COALESCE(md.coordenacao_id, pd.coordenacao_id)',
    'g'
  );

  IF d2 = d THEN
    RAISE EXCEPTION 'nenhuma substituicao aplicada (padrao nao encontrado)';
  END IF;

  EXECUTE d2;
END
$mig$;