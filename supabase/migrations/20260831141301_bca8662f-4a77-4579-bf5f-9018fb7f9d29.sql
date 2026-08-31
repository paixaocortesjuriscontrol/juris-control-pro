DO $mig$
DECLARE
  src text;
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['get_distribuicao_tst_stats','get_distribuicao_tst_situacao_totais','get_distribuicao_tst_responsaveis_counts','get_distribuicao_tst_multi_resp_ids'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = fn;
    IF src IS NULL THEN CONTINUE; END IF;
    src := replace(src,
      'AND (v_status IS NULL OR v_status = ''todos'' OR db.status::text = v_status)',
      'AND (v_status IS NULL OR v_status = ''todos'' OR (v_status = ''concluidos'' AND db.status::text IN (''pronto_envio'',''planilhado'',''enviado'')) OR (v_status <> ''concluidos'' AND db.status::text = v_status))');
    EXECUTE src;
  END LOOP;
END
$mig$;