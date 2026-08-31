DO $mig$
DECLARE src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_distribuicao_tst_responsaveis_counts';
  IF src IS NULL THEN RAISE EXCEPTION 'função não encontrada'; END IF;
  src := replace(src,
    'COUNT(*) FILTER (WHERE b.status::text = ''pronto_envio'')::bigint AS pronto',
    'COUNT(*) FILTER (WHERE b.status::text IN (''pronto_envio'',''planilhado'',''enviado''))::bigint AS pronto');
  EXECUTE src;
END
$mig$;