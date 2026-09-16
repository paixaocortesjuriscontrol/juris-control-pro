DO $mig$
DECLARE
  r record;
  def text;
  novo text;
BEGIN
  FOR r IN SELECT oid, proname FROM pg_proc
           WHERE proname IN ('get_distribuicao_tst_stats','get_distribuicao_tst_situacao_totais')
  LOOP
    def := pg_get_functiondef(r.oid);
    novo := def;

    -- 1) filtro "A fazer": também exclui Acordo
    novo := replace(novo,
      E'OR (\'a_fazer\' = ANY(v_situacoes)\n            AND db.cejusc IS DISTINCT FROM true',
      E'OR (\'a_fazer\' = ANY(v_situacoes)\n            AND db.cejusc IS DISTINCT FROM true\n            AND db.acordo IS DISTINCT FROM true');

    -- 2) filtro "Não precisa fazer": inclui Acordo
    novo := replace(novo,
      E'OR (\'nao_precisa_fazer\' = ANY(v_situacoes)\n            AND (db.transito_julgado = true\n                 OR db.processo_outro_escritorio = true\n                 OR db.segredo_justica = true\n                 OR db.cejusc = true)',
      E'OR (\'nao_precisa_fazer\' = ANY(v_situacoes)\n            AND (db.transito_julgado = true\n                 OR db.processo_outro_escritorio = true\n                 OR db.segredo_justica = true\n                 OR db.cejusc = true\n                 OR db.acordo = true)');

    -- 3) contador "A fazer"
    novo := replace(novo,
      E'        AND b.cejusc IS DISTINCT FROM true\n        AND (b.status IS NULL OR b.status::text NOT IN (\'pronto_envio\',\'planilhado\',\'enviado\'))',
      E'        AND b.cejusc IS DISTINCT FROM true\n        AND b.acordo IS DISTINCT FROM true\n        AND (b.status IS NULL OR b.status::text NOT IN (\'pronto_envio\',\'planilhado\',\'enviado\'))');

    -- 4) contador "Não precisa fazer" (somente em get_distribuicao_tst_stats)
    novo := replace(novo,
      E'      WHERE b.transito_julgado = true\n         OR b.processo_outro_escritorio = true\n         OR b.segredo_justica = true\n         OR b.cejusc = true',
      E'      WHERE b.transito_julgado = true\n         OR b.processo_outro_escritorio = true\n         OR b.segredo_justica = true\n         OR b.cejusc = true\n         OR b.acordo = true');

    IF novo = def THEN
      RAISE EXCEPTION 'Nenhuma alteração aplicada em %', r.proname;
    END IF;

    EXECUTE novo;
  END LOOP;
END
$mig$;