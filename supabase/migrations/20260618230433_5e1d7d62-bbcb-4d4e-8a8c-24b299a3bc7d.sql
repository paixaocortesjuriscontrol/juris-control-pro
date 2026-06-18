
CREATE OR REPLACE FUNCTION public.get_meses_data_distribuicao_real()
RETURNS TABLE(mes_ano text, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT to_char(d.data_distribuicao_real, 'YYYY-MM') AS mes_ano,
         count(*) AS total
  FROM public.dados_benner d
  WHERE d.aba_origem IS NOT NULL
    AND d.data_distribuicao_real IS NOT NULL
  GROUP BY 1
  ORDER BY 1 DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_meses_data_distribuicao_real() TO authenticated;
