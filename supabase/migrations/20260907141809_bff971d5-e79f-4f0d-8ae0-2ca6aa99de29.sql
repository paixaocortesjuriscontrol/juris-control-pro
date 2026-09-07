DROP FUNCTION IF EXISTS public.comparar_kurier_djen_por_login(text[], date, date, integer);
DROP FUNCTION IF EXISTS public.comparar_kurier_djen_por_login(text[], date, date, integer, text[]);

CREATE FUNCTION public.comparar_kurier_djen_por_login(
  p_logins text[],
  p_ini date,
  p_fim date,
  p_limite integer DEFAULT 5000,
  p_vinculos text[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
WITH logins AS (
  SELECT kc.id, kc.login
  FROM kurier_credenciais kc
  WHERE (p_logins IS NULL OR kc.login = ANY(p_logins))
    AND (p_logins IS NOT NULL OR kc.ativo IS TRUE)
),
coords AS (
  SELECT DISTINCT l.login, kcc.coordenacao_id
  FROM logins l
  JOIN kurier_credencial_coordenacoes kcc ON kcc.credencial_id = l.id
  WHERE CASE
    WHEN p_vinculos IS NULL OR array_length(p_vinculos, 1) IS NULL
      THEN COALESCE(kcc.somente_kurier_only, false) = false
    ELSE (
      ('captura_total' = ANY(p_vinculos) AND COALESCE(kcc.captura_total, false))
      OR ('so_kurier' = ANY(p_vinculos) AND COALESCE(kcc.somente_kurier_only, false))
      OR ('termos_djen' = ANY(p_vinculos) AND COALESCE(kcc.somente_djen_only, false))
    )
  END
),
k AS MATERIALIZED (
  SELECT l.login,
         p.id::text AS id,
         p.id_djen,
         p.processo_numero,
         p.tribunal,
         p.orgao,
         p.tipo_comunicacao,
         p.data_disponibilizacao,
         p.data_publicacao,
         p.coordenacao_id,
         regexp_replace(COALESCE(p.processo_numero, ''), '\D', '', 'g') AS pn,
         COALESCE(p.data_disponibilizacao, p.data_publicacao)::date AS dref
  FROM publicacoes_djen p
  JOIN logins l ON l.login = p.kurier_login
  WHERE p.fonte = 'kurier'
    AND COALESCE(p.data_disponibilizacao, p.data_publicacao) >= p_ini::timestamptz
    AND COALESCE(p.data_disponibilizacao, p.data_publicacao) < (p_fim + 1)::timestamptz
),
d AS MATERIALIZED (
  SELECT c.login,
         p.id::text AS id,
         p.id_djen,
         p.processo_numero,
         p.tribunal,
         p.orgao,
         p.tipo_comunicacao,
         p.data_disponibilizacao,
         p.data_publicacao,
         p.coordenacao_id,
         regexp_replace(COALESCE(p.processo_numero, ''), '\D', '', 'g') AS pn,
         COALESCE(p.data_disponibilizacao, p.data_publicacao)::date AS dref
  FROM publicacoes_djen p
  JOIN coords c ON c.coordenacao_id = p.coordenacao_id
  WHERE p.fonte IS DISTINCT FROM 'kurier'
    AND COALESCE(p.data_disponibilizacao, p.data_publicacao) >= p_ini::timestamptz
    AND COALESCE(p.data_disponibilizacao, p.data_publicacao) < (p_fim + 1)::timestamptz
  UNION ALL
  SELECT c.login,
         p.id::text AS id,
         p.id_djen,
         p.processo_numero,
         p.tribunal,
         p.orgao,
         p.tipo_comunicacao,
         p.data_disponibilizacao,
         p.data_publicacao,
         p.coordenacao_id,
         regexp_replace(COALESCE(p.processo_numero, ''), '\D', '', 'g') AS pn,
         COALESCE(p.data_disponibilizacao, p.data_publicacao)::date AS dref
  FROM publicacoes_djen_servidor p
  JOIN coords c ON c.coordenacao_id = p.coordenacao_id
  WHERE p.fonte IS DISTINCT FROM 'kurier'
    AND COALESCE(p.data_disponibilizacao, p.data_publicacao) >= p_ini::timestamptz
    AND COALESCE(p.data_disponibilizacao, p.data_publicacao) < (p_fim + 1)::timestamptz
),
d_id AS (SELECT DISTINCT login, id_djen FROM d WHERE id_djen IS NOT NULL),
d_pn AS (SELECT DISTINCT login, pn, dref + off AS dref FROM d, generate_series(-1, 1) off WHERE pn <> ''),
k_id AS (SELECT DISTINCT login, id_djen FROM k WHERE id_djen IS NOT NULL),
k_pn AS (SELECT DISTINCT login, pn, dref + off AS dref FROM k, generate_series(-1, 1) off WHERE pn <> ''),
kf AS MATERIALIZED (
  SELECT k.*, (di.id_djen IS NOT NULL OR dp.pn IS NOT NULL) AS achou
  FROM k
  LEFT JOIN d_id di ON di.login = k.login AND di.id_djen = k.id_djen
  LEFT JOIN d_pn dp ON dp.login = k.login AND dp.pn = k.pn AND dp.dref = k.dref AND k.pn <> ''
),
df AS MATERIALIZED (
  SELECT d.*, (ki.id_djen IS NOT NULL OR kp.pn IS NOT NULL) AS achou
  FROM d
  LEFT JOIN k_id ki ON ki.login = d.login AND ki.id_djen = d.id_djen
  LEFT JOIN k_pn kp ON kp.login = d.login AND kp.pn = d.pn AND kp.dref = d.dref AND d.pn <> ''
),
resumo AS (
  SELECT l.login,
         (SELECT count(*) FROM kf WHERE kf.login = l.login) AS total_kurier,
         (SELECT count(*) FROM df WHERE df.login = l.login) AS total_djen,
         (SELECT count(*) FROM kf WHERE kf.login = l.login AND kf.achou) AS ambos,
         (SELECT count(*) FROM kf WHERE kf.login = l.login AND NOT kf.achou) AS so_kurier,
         (SELECT count(*) FROM df WHERE df.login = l.login AND NOT df.achou) AS so_djen,
         (SELECT coalesce(json_agg(DISTINCT c.nome ORDER BY c.nome), '[]'::json)
            FROM coords cc JOIN coordenacoes c ON c.id = cc.coordenacao_id
            WHERE cc.login = l.login) AS coordenacoes
  FROM logins l
),
tribunais AS (
  SELECT coalesce(tribunal, '—') AS tribunal,
         count(*) FILTER (WHERE origem = 'ambos') AS ambos,
         count(*) FILTER (WHERE origem = 'so_kurier') AS so_kurier,
         count(*) FILTER (WHERE origem = 'so_djen') AS so_djen
  FROM (
    SELECT tribunal, CASE WHEN achou THEN 'ambos' ELSE 'so_kurier' END AS origem FROM kf
    UNION ALL
    SELECT tribunal, 'so_djen' AS origem FROM df WHERE NOT achou
  ) t
  GROUP BY 1
),
linhas AS (
  SELECT * FROM (
    SELECT 'so_kurier' AS origem, x.login, x.id, x.id_djen, x.processo_numero, x.tribunal, x.orgao,
           x.tipo_comunicacao, x.data_disponibilizacao, x.data_publicacao, c.nome AS coordenacao
    FROM kf x LEFT JOIN coordenacoes c ON c.id = x.coordenacao_id
    WHERE NOT x.achou
    ORDER BY x.data_disponibilizacao DESC NULLS LAST
    LIMIT p_limite
  ) a
  UNION ALL
  SELECT * FROM (
    SELECT 'so_djen' AS origem, x.login, x.id, x.id_djen, x.processo_numero, x.tribunal, x.orgao,
           x.tipo_comunicacao, x.data_disponibilizacao, x.data_publicacao, c.nome AS coordenacao
    FROM df x LEFT JOIN coordenacoes c ON c.id = x.coordenacao_id
    WHERE NOT x.achou
    ORDER BY x.data_disponibilizacao DESC NULLS LAST
    LIMIT p_limite
  ) b
  UNION ALL
  SELECT * FROM (
    SELECT 'ambos' AS origem, x.login, x.id, x.id_djen, x.processo_numero, x.tribunal, x.orgao,
           x.tipo_comunicacao, x.data_disponibilizacao, x.data_publicacao, c.nome AS coordenacao
    FROM kf x LEFT JOIN coordenacoes c ON c.id = x.coordenacao_id
    WHERE x.achou
    ORDER BY x.data_disponibilizacao DESC NULLS LAST
    LIMIT p_limite
  ) e
)
SELECT jsonb_build_object(
  'resumo', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.so_kurier DESC), '[]'::jsonb) FROM resumo r),
  'tribunais', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY (t.ambos + t.so_kurier + t.so_djen) DESC), '[]'::jsonb) FROM tribunais t),
  'linhas', (SELECT coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) FROM linhas l),
  'limite', p_limite
);
$fn$;

GRANT EXECUTE ON FUNCTION public.comparar_kurier_djen_por_login(text[], date, date, integer, text[]) TO authenticated, service_role;