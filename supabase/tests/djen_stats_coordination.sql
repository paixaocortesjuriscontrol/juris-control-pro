-- Read-only regression: distributed publications belong to the destination.
WITH fixtures AS (
  SELECT n AS id, 'destination'::text AS publication_coord, 'origin'::text AS monitoring_coord
  FROM generate_series(1, 4) n
  UNION ALL SELECT 5, NULL, 'origin'
), counts AS (
  SELECT count(*) FILTER (WHERE coalesce(publication_coord, monitoring_coord) = 'destination') AS destination,
         count(*) FILTER (WHERE coalesce(publication_coord, monitoring_coord) = 'origin') AS origin
  FROM fixtures
), definitions AS (
  SELECT pg_get_functiondef(p.oid) AS definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_djen_stats_per_user' AND p.pronargs IN (6, 9)
)
SELECT 1 / CASE WHEN counts.destination = 4 AND counts.origin = 1
  AND (SELECT count(*) FROM definitions) = 2
  AND NOT EXISTS (
    SELECT 1 FROM definitions WHERE
      definition NOT LIKE '%WHERE (p_coordenacao_id IS NULL OR COALESCE(pd.coordenacao_id, md.coordenacao_id) = p_coordenacao_id)%'
      OR definition NOT LIKE '%mc.coordenacao_id = COALESCE(pd.coordenacao_id, md.coordenacao_id)%'
      OR definition NOT LIKE '%COALESCE(pd.coordenacao_id, md.coordenacao_id) AS dedup_coord%'
  ) THEN 1 ELSE 0 END AS regression_passed
FROM counts;