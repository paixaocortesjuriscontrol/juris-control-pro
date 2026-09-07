DROP FUNCTION IF EXISTS public.comparar_kurier_djen_por_login(text[], date, date, integer);

CREATE FUNCTION public.comparar_kurier_djen_por_login(
  p_logins text[],
  p_ini date,
  p_fim date,
  p_limite integer DEFAULT 5000
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_result jsonb;
BEGIN
  DROP TABLE IF EXISTS tmp_logins, tmp_coords, tmp_k, tmp_d;

  CREATE TEMP TABLE tmp_logins ON COMMIT DROP AS
    SELECT kc.id, kc.login
    FROM kurier_credenciais kc
    WHERE (p_logins IS NULL OR kc.login = ANY(p_logins))
      AND (p_logins IS NOT NULL OR kc.ativo IS TRUE);

  CREATE TEMP TABLE tmp_coords ON COMMIT DROP AS
    SELECT DISTINCT l.login, kcc.coordenacao_id
    FROM tmp_logins l
    JOIN kurier_credencial_coordenacoes kcc ON kcc.credencial_id = l.id
    WHERE COALESCE(kcc.somente_kurier_only, false) = false;

  CREATE TEMP TABLE tmp_k ON COMMIT DROP AS
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
           COALESCE(p.data_disponibilizacao, p.data_publicacao)::date AS dref,
           false AS achou
    FROM publicacoes_djen p
    JOIN tmp_logins l ON l.login = p.kurier_login
    WHERE p.fonte = 'kurier'
      AND COALESCE(p.data_disponibilizacao, p.data_publicacao) >= p_ini::timestamptz
      AND COALESCE(p.data_disponibilizacao, p.data_publicacao) < (p_fim + 1)::timestamptz;

  CREATE TEMP TABLE tmp_d ON COMMIT DROP AS
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
           COALESCE(p.data_disponibilizacao, p.data_publicacao)::date AS dref,
           false AS achou
    FROM publicacoes_djen p
    JOIN tmp_coords c ON c.coordenacao_id = p.coordenacao_id
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
           COALESCE(p.data_disponibilizacao, p.data_publicacao)::date AS dref,
           false AS achou
    FROM publicacoes_djen_servidor p
    JOIN tmp_coords c ON c.coordenacao_id = p.coordenacao_id
    WHERE p.fonte IS DISTINCT FROM 'kurier'
      AND COALESCE(p.data_disponibilizacao, p.data_publicacao) >= p_ini::timestamptz
      AND COALESCE(p.data_disponibilizacao, p.data_publicacao) < (p_fim + 1)::timestamptz;

  CREATE INDEX ON tmp_k (login, id_djen);
  CREATE INDEX ON tmp_k (login, pn, dref);
  CREATE INDEX ON tmp_d (login, id_djen);
  CREATE INDEX ON tmp_d (login, pn, dref);
  ANALYZE tmp_k;
  ANALYZE tmp_d;

  UPDATE tmp_k k SET achou = true
  WHERE EXISTS (
    SELECT 1 FROM tmp_d d
    WHERE d.login = k.login AND k.id_djen IS NOT NULL AND d.id_djen = k.id_djen
  );

  UPDATE tmp_k k SET achou = true
  WHERE NOT k.achou AND k.pn <> '' AND EXISTS (
    SELECT 1 FROM tmp_d d
    WHERE d.login = k.login AND d.pn = k.pn
      AND d.dref BETWEEN k.dref - 1 AND k.dref + 1
  );

  UPDATE tmp_d d SET achou = true
  WHERE EXISTS (
    SELECT 1 FROM tmp_k k
    WHERE k.login = d.login AND d.id_djen IS NOT NULL AND k.id_djen = d.id_djen
  );

  UPDATE tmp_d d SET achou = true
  WHERE NOT d.achou AND d.pn <> '' AND EXISTS (
    SELECT 1 FROM tmp_k k
    WHERE k.login = d.login AND k.pn = d.pn
      AND k.dref BETWEEN d.dref - 1 AND d.dref + 1
  );

  WITH resumo AS (
    SELECT l.login,
           (SELECT count(*) FROM tmp_k kf WHERE kf.login = l.login) AS total_kurier,
           (SELECT count(*) FROM tmp_d df WHERE df.login = l.login) AS total_djen,
           (SELECT count(*) FROM tmp_k kf WHERE kf.login = l.login AND kf.achou) AS ambos,
           (SELECT count(*) FROM tmp_k kf WHERE kf.login = l.login AND NOT kf.achou) AS so_kurier,
           (SELECT count(*) FROM tmp_d df WHERE df.login = l.login AND NOT df.achou) AS so_djen,
           (SELECT coalesce(json_agg(DISTINCT c.nome ORDER BY c.nome), '[]'::json)
              FROM tmp_coords cc JOIN coordenacoes c ON c.id = cc.coordenacao_id
              WHERE cc.login = l.login) AS coordenacoes
    FROM tmp_logins l
  ),
  tribunais AS (
    SELECT coalesce(tribunal, '—') AS tribunal,
           count(*) FILTER (WHERE origem = 'ambos') AS ambos,
           count(*) FILTER (WHERE origem = 'so_kurier') AS so_kurier,
           count(*) FILTER (WHERE origem = 'so_djen') AS so_djen
    FROM (
      SELECT tribunal, CASE WHEN achou THEN 'ambos' ELSE 'so_kurier' END AS origem FROM tmp_k
      UNION ALL
      SELECT tribunal, 'so_djen' AS origem FROM tmp_d WHERE NOT achou
    ) t
    GROUP BY 1
  ),
  linhas AS (
    SELECT * FROM (
      SELECT 'so_kurier' AS origem, x.login, x.id, x.id_djen, x.processo_numero, x.tribunal, x.orgao,
             x.tipo_comunicacao, x.data_disponibilizacao, x.data_publicacao, c.nome AS coordenacao
      FROM tmp_k x LEFT JOIN coordenacoes c ON c.id = x.coordenacao_id
      WHERE NOT x.achou
      ORDER BY x.data_disponibilizacao DESC NULLS LAST
      LIMIT p_limite
    ) a
    UNION ALL
    SELECT * FROM (
      SELECT 'so_djen' AS origem, x.login, x.id, x.id_djen, x.processo_numero, x.tribunal, x.orgao,
             x.tipo_comunicacao, x.data_disponibilizacao, x.data_publicacao, c.nome AS coordenacao
      FROM tmp_d x LEFT JOIN coordenacoes c ON c.id = x.coordenacao_id
      WHERE NOT x.achou
      ORDER BY x.data_disponibilizacao DESC NULLS LAST
      LIMIT p_limite
    ) b
    UNION ALL
    SELECT * FROM (
      SELECT 'ambos' AS origem, x.login, x.id, x.id_djen, x.processo_numero, x.tribunal, x.orgao,
             x.tipo_comunicacao, x.data_disponibilizacao, x.data_publicacao, c.nome AS coordenacao
      FROM tmp_k x LEFT JOIN coordenacoes c ON c.id = x.coordenacao_id
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
  ) INTO v_result;

  DROP TABLE IF EXISTS tmp_logins, tmp_coords, tmp_k, tmp_d;

  RETURN v_result;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.comparar_kurier_djen_por_login(text[], date, date, integer) TO authenticated, service_role;