DO $mig$
DECLARE
  def text;
  alvo text;
BEGIN
  def := pg_get_functiondef('get_distribuicao_tst_stats'::regproc);

  alvo := 'sem_materia_dossie bigint)';
  IF position(alvo in def) = 0 THEN RAISE EXCEPTION 'stats: retorno'; END IF;
  def := replace(def, alvo, 'sem_materia_dossie bigint,
    arquivados bigint)');

  alvo := chr(10) || '  )' || chr(10) || '  SELECT' || chr(10) || '    COUNT(*)::bigint,';
  IF position(alvo in def) = 0 THEN RAISE EXCEPTION 'stats: cte'; END IF;
  def := replace(def, alvo, chr(10) || '
  ),
  arquivados_totais AS (
    SELECT COUNT(*)::bigint AS n
    FROM base
    WHERE lower(btrim(situacao_processo)) = ''arquivado''
  ),
  ativos AS (
    SELECT * FROM base
    WHERE (''arquivado'' = ANY(COALESCE(v_situacoes, ARRAY[]::text[])))
       OR lower(btrim(situacao_processo)) IS DISTINCT FROM ''arquivado''
  )
  SELECT' || chr(10) || '    COUNT(*)::bigint,');

  alvo := '  FROM base b;' || chr(10);
  IF position(alvo in def) = 0 THEN RAISE EXCEPTION 'stats: from'; END IF;
  def := replace(def, alvo, '
  , (SELECT n FROM arquivados_totais)::bigint
  FROM ativos b;' || chr(10));

  alvo := '
        OR (''outros'' = ANY(v_situacoes) AND (
              db.situacao_processo IS NULL
              OR lower(db.situacao_processo) <> ''ativo''
            )
            AND db.transito_julgado IS DISTINCT FROM true
        )';
  IF position(alvo in def) = 0 THEN RAISE EXCEPTION 'stats: outros'; END IF;
  def := replace(def, alvo, '
        OR (''outros'' = ANY(v_situacoes) AND (
              db.situacao_processo IS NULL
              OR lower(db.situacao_processo) <> ''ativo''
            )
            AND lower(btrim(db.situacao_processo)) IS DISTINCT FROM ''arquivado''
            AND db.transito_julgado IS DISTINCT FROM true
        )
        OR (''arquivado'' = ANY(v_situacoes) AND lower(btrim(db.situacao_processo)) = ''arquivado'')');

  DROP FUNCTION public.get_distribuicao_tst_stats(jsonb);
  EXECUTE def;

  def := pg_get_functiondef('get_distribuicao_tst_situacao_totais'::regproc);

  alvo := '    WHERE db.aba_origem IS NOT NULL' || chr(10);
  IF position(alvo in def) = 0 THEN RAISE EXCEPTION 'totais: where'; END IF;
  def := replace(def, alvo, '    WHERE db.aba_origem IS NOT NULL' || chr(10) || '
      AND (''arquivado'' = ANY(COALESCE(v_situacoes, ARRAY[]::text[]))
           OR lower(btrim(db.situacao_processo)) IS DISTINCT FROM ''arquivado'')' || chr(10));

  alvo := '
        OR (''outros'' = ANY(v_situacoes) AND (
              db.situacao_processo IS NULL
              OR lower(db.situacao_processo) <> ''ativo''
            )
            AND db.transito_julgado IS DISTINCT FROM true
        )';
  IF position(alvo in def) = 0 THEN RAISE EXCEPTION 'totais: outros'; END IF;
  def := replace(def, alvo, '
        OR (''outros'' = ANY(v_situacoes) AND (
              db.situacao_processo IS NULL
              OR lower(db.situacao_processo) <> ''ativo''
            )
            AND lower(btrim(db.situacao_processo)) IS DISTINCT FROM ''arquivado''
            AND db.transito_julgado IS DISTINCT FROM true
        )
        OR (''arquivado'' = ANY(v_situacoes) AND lower(btrim(db.situacao_processo)) = ''arquivado'')');

  DROP FUNCTION public.get_distribuicao_tst_situacao_totais(jsonb);
  EXECUTE def;
END
$mig$;

GRANT EXECUTE ON FUNCTION public.get_distribuicao_tst_stats(jsonb), public.get_distribuicao_tst_situacao_totais(jsonb) TO authenticated;
