CREATE OR REPLACE FUNCTION public.get_inteligencia_filtros()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH equipes AS (
  SELECT trim(equipe) AS valor
  FROM public.dados_benner
  WHERE NULLIF(trim(equipe), '') IS NOT NULL
  GROUP BY trim(equipe)
),
tribunais_tst AS (
  SELECT trim(tribunal) AS valor
  FROM public.dados_benner
  WHERE NULLIF(trim(tribunal), '') IS NOT NULL
  GROUP BY trim(tribunal)
),
tribunais_processos AS (
  SELECT trim(tribunal) AS valor
  FROM public.processos
  WHERE NULLIF(trim(tribunal), '') IS NOT NULL
  GROUP BY trim(tribunal)
),
tribunais AS (
  SELECT
    COALESCE(t.valor, p.valor) AS valor,
    (t.valor IS NOT NULL) AS tst,
    (p.valor IS NOT NULL) AS processos
  FROM tribunais_tst t
  FULL JOIN tribunais_processos p ON lower(t.valor) = lower(p.valor)
)
SELECT jsonb_build_object(
  'equipes', COALESCE((SELECT jsonb_agg(valor ORDER BY valor) FROM equipes), '[]'::jsonb),
  'tribunais', COALESCE((SELECT jsonb_agg(jsonb_build_object('valor', valor, 'tst', tst, 'processos', processos) ORDER BY valor) FROM tribunais), '[]'::jsonb)
);
$$;

REVOKE EXECUTE ON FUNCTION public.get_inteligencia_filtros() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inteligencia_filtros() TO authenticated, service_role;