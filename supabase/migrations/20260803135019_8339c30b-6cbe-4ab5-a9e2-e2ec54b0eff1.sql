DO $mig$
DECLARE
  d text;
  d0 text;
BEGIN
  d := pg_get_functiondef('public.get_distribuicao_tst_stats(jsonb)'::regprocedure);
  d0 := d;

  -- 1) expõe data_distribuicao_planilha na CTE base
  d := replace(
    d,
    '      db.data_distribuicao_real,' || E'\n' || '      db.status,',
    '      db.data_distribuicao_real,' || E'\n' || '      db.data_distribuicao_planilha,' || E'\n' || '      db.status,'
  );

  -- 2) faixas de data passam a usar a data efetiva (real, senão planilha)
  d := replace(
    d,
    'COUNT(*) FILTER (WHERE b.data_distribuicao_real IS NOT NULL AND b.data_distribuicao_real <= ''2025-12-31''::date)::bigint',
    'COUNT(*) FILTER (WHERE COALESCE(b.data_distribuicao_real, b.data_distribuicao_planilha) IS NOT NULL AND COALESCE(b.data_distribuicao_real, b.data_distribuicao_planilha) <= ''2025-12-31''::date)::bigint'
  );
  d := replace(
    d,
    'COUNT(*) FILTER (WHERE b.data_distribuicao_real IS NOT NULL AND b.data_distribuicao_real >= ''2026-01-01''::date)::bigint',
    'COUNT(*) FILTER (WHERE COALESCE(b.data_distribuicao_real, b.data_distribuicao_planilha) IS NOT NULL AND COALESCE(b.data_distribuicao_real, b.data_distribuicao_planilha) >= ''2026-01-01''::date)::bigint'
  );

  IF d = d0 THEN
    RAISE EXCEPTION 'Nenhuma substituicao aplicada em get_distribuicao_tst_stats';
  END IF;
  IF position('data_distribuicao_planilha' in d) = 0 THEN
    RAISE EXCEPTION 'Substituicao da CTE base falhou';
  END IF;

  EXECUTE d;
END
$mig$;