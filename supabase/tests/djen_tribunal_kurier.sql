-- Read-only regression: exact region boundaries and all four RPC definitions.
WITH cases(valor, filtro, esperado) AS (
  VALUES ('TRT 3_DJEN', 'TRT3', true), ('TRT3', 'TRT3', true),
    ('TRT - 3 REGIAO', 'TRT3', true), ('TRT 13_DJEN', 'TRT3', false),
    ('TRT 30_DJEN', 'TRT3', false), ('TRF 3_DJEN', 'TRF3', true),
    ('TST_DJEN', 'TST', true)
), checks AS (
  SELECT bool_and((upper(valor) ~ ('(^|[^A-Z0-9])' ||
    regexp_replace(filtro, '^(TRT|TRF)([0-9]+)$', '\1[[:space:]-]*\2') ||
    '([^A-Z0-9]|$)')) = esperado) AS passou FROM cases
), definitions AS (
  SELECT count(*) = 4 AND bool_and(strpos(pg_get_functiondef(p.oid), '\1[[:space:]-]*\2') > 0)
    AS passou
  FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
    AND p.proname IN ('get_djen_publicacoes_unificadas', 'get_djen_publicacoes_servidor_unificadas',
      'get_djen_stats_per_user', 'get_djen_stats_servidor_per_user')
    AND 'p_tribunal' = ANY(p.proargnames)
)
SELECT checks.passou AND definitions.passou AS regression_passed FROM checks, definitions;