DO $mig$
DECLARE
  d text;
  d0 text;
BEGIN
  d := pg_get_functiondef('public.get_distribuicao_tst_stats(jsonb)'::regprocedure);
  d0 := d;

  d := replace(d,
    'OR (v_mes_ano = ''sem-data'' AND db.data_distribuicao_real IS NULL)',
    'OR (v_mes_ano = ''sem-data'' AND COALESCE(db.data_distribuicao_real, db.data_distribuicao_planilha) IS NULL)');
  d := replace(d,
    'OR (v_mes_ano <> ''sem-data'' AND db.data_distribuicao_real >= v_mes_start AND db.data_distribuicao_real < v_mes_end)',
    'OR (v_mes_ano <> ''sem-data'' AND COALESCE(db.data_distribuicao_real, db.data_distribuicao_planilha) >= v_mes_start AND COALESCE(db.data_distribuicao_real, db.data_distribuicao_planilha) < v_mes_end)');
  d := replace(d,
    'AND (v_data_inicio IS NULL OR db.data_distribuicao_real >= v_data_inicio::date)',
    'AND (v_data_inicio IS NULL OR COALESCE(db.data_distribuicao_real, db.data_distribuicao_planilha) >= v_data_inicio::date)');
  d := replace(d,
    'AND (v_data_fim    IS NULL OR db.data_distribuicao_real <= v_data_fim::date)',
    'AND (v_data_fim    IS NULL OR COALESCE(db.data_distribuicao_real, db.data_distribuicao_planilha) <= v_data_fim::date)');

  IF d = d0 THEN
    RAISE EXCEPTION 'Nenhuma substituicao aplicada nos filtros de data';
  END IF;

  EXECUTE d;
END
$mig$;