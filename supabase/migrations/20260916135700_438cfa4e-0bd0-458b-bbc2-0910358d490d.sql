DO $$
DECLARE src text; newsrc text;
BEGIN
  SELECT prosrc INTO src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='get_distribuicao_tst_stats';

  IF position('      db.acordo,' in src) = 0 THEN
    newsrc := replace(src, E'      db.tem_materias_dossie\n', E'      db.tem_materias_dossie,\n      db.acordo\n');
    IF newsrc = src THEN
      RAISE EXCEPTION 'padrao nao encontrado';
    END IF;
    EXECUTE 'CREATE OR REPLACE FUNCTION public.get_distribuicao_tst_stats(filters jsonb DEFAULT ''{}''::jsonb) RETURNS ' ||
      pg_get_function_result((SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_distribuicao_tst_stats')) ||
      ' LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS ' || quote_literal(newsrc);
  END IF;
END $$;