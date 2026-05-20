CREATE OR REPLACE FUNCTION public.apply_data_planilha_fix(items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  WITH s AS (
    SELECT digits, dossie, data_pl
    FROM jsonb_to_recordset(items) AS x(digits text, dossie text, data_pl date)
  )
  UPDATE public.dados_benner b
  SET data_distribuicao_planilha = s.data_pl
  FROM s
  WHERE regexp_replace(COALESCE(b.processo,''),'\D','','g') = s.digits
    AND b.dossie = s.dossie;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_data_planilha_fix(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_data_planilha_fix(jsonb) TO authenticated;