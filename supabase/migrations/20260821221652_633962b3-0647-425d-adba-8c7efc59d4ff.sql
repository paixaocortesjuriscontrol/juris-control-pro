DO $mig$
DECLARE
  d text;
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['public.get_distribuicao_tst_stats(jsonb)','public.get_distribuicao_tst_situacao_totais(jsonb)'] LOOP
    d := pg_get_functiondef(fn::regprocedure);

    -- base CTE precisa expor db.cejusc (stats ainda não seleciona)
    IF position('db.cejusc' in d) = 0 THEN
      d := replace(d,
        E'      db.segredo_justica,\n      db.turma,',
        E'      db.segredo_justica,\n      db.cejusc,\n      db.turma,');
    END IF;

    -- nova opção de filtro: CEJUSC
    IF position(E'v_situacao = ''cejusc''' in d) = 0 THEN
      d := replace(d,
        E'OR (v_situacao = ''segredo_justica'' AND db.segredo_justica = true)',
        E'OR (v_situacao = ''segredo_justica'' AND db.segredo_justica = true)\n        OR (v_situacao = ''cejusc'' AND db.cejusc = true)');
    END IF;

    -- filtro "A fazer" exclui CEJUSC
    d := replace(d,
      E'OR (v_situacao = ''a_fazer''\n            AND db.transito_julgado IS DISTINCT FROM true',
      E'OR (v_situacao = ''a_fazer''\n            AND db.cejusc IS DISTINCT FROM true\n            AND db.transito_julgado IS DISTINCT FROM true');

    -- filtro "Não precisa fazer" inclui CEJUSC
    d := replace(d,
      E'AND (db.transito_julgado = true\n                 OR db.processo_outro_escritorio = true\n                 OR db.segredo_justica = true)',
      E'AND (db.transito_julgado = true\n                 OR db.processo_outro_escritorio = true\n                 OR db.segredo_justica = true\n                 OR db.cejusc = true)');

    -- contagem "A fazer" exclui CEJUSC
    d := replace(d,
      E'        AND b.segredo_justica IS DISTINCT FROM true\n        AND (b.status IS NULL OR b.status::text <> ''pronto_envio'')',
      E'        AND b.segredo_justica IS DISTINCT FROM true\n        AND b.cejusc IS DISTINCT FROM true\n        AND (b.status IS NULL OR b.status::text <> ''pronto_envio'')');

    -- contagem "Não precisa fazer" inclui CEJUSC
    d := replace(d,
      E'      WHERE b.transito_julgado = true\n         OR b.processo_outro_escritorio = true\n         OR b.segredo_justica = true\n    )',
      E'      WHERE b.transito_julgado = true\n         OR b.processo_outro_escritorio = true\n         OR b.segredo_justica = true\n         OR b.cejusc = true\n    )');

    EXECUTE d;
  END LOOP;
END
$mig$;