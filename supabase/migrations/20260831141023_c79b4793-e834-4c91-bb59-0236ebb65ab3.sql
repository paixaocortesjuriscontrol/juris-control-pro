DO $mig$
DECLARE
  src text;
BEGIN
  -- 1) get_distribuicao_tst_stats: a_fazer exclui pronto_envio/planilhado/enviado;
  --    pronto_envio soma concluídos; novas colunas de detalhamento.
  SELECT pg_get_functiondef(p.oid) INTO src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_distribuicao_tst_stats';

  src := replace(src,
    'AND (db.status IS NULL OR db.status::text <> ''pronto_envio'')',
    'AND (db.status IS NULL OR db.status::text NOT IN (''pronto_envio'',''planilhado'',''enviado''))');
  src := replace(src,
    'AND (b.status IS NULL OR b.status::text <> ''pronto_envio'')',
    'AND (b.status IS NULL OR b.status::text NOT IN (''pronto_envio'',''planilhado'',''enviado''))');
  src := replace(src,
    'COUNT(*) FILTER (WHERE b.status::text = ''pronto_envio'')::bigint',
    'COUNT(*) FILTER (WHERE b.status::text IN (''pronto_envio'',''planilhado'',''enviado''))::bigint');
  src := replace(src,
    'nao_precisa_fazer bigint)',
    'nao_precisa_fazer bigint, pronto_envio_puro bigint, planilhado bigint, enviado bigint)');
  src := replace(src,
    E'  FROM base b;',
    E',\n    COUNT(*) FILTER (WHERE b.status::text = ''pronto_envio'')::bigint,\n    COUNT(*) FILTER (WHERE b.status::text = ''planilhado'')::bigint,\n    COUNT(*) FILTER (WHERE b.status::text = ''enviado'')::bigint\n  FROM base b;');

  DROP FUNCTION IF EXISTS public.get_distribuicao_tst_stats(jsonb);
  EXECUTE src;

  -- 2) get_distribuicao_tst_situacao_totais: mesma regra de conclusão.
  SELECT pg_get_functiondef(p.oid) INTO src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_distribuicao_tst_situacao_totais';

  src := replace(src,
    'AND (db.status IS NULL OR db.status::text <> ''pronto_envio'')',
    'AND (db.status IS NULL OR db.status::text NOT IN (''pronto_envio'',''planilhado'',''enviado''))');
  src := replace(src,
    'AND (b.status IS NULL OR b.status::text <> ''pronto_envio'')',
    'AND (b.status IS NULL OR b.status::text NOT IN (''pronto_envio'',''planilhado'',''enviado''))');
  src := replace(src,
    'COUNT(*) FILTER (WHERE b.status::text = ''pronto_envio'')::bigint',
    'COUNT(*) FILTER (WHERE b.status::text IN (''pronto_envio'',''planilhado'',''enviado''))::bigint');

  EXECUTE src;
END
$mig$;