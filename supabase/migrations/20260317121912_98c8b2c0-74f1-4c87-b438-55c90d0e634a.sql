-- Normaliza timestamps das capturas DJEN de hoje para meio-dia UTC
-- evitando regressão de apresentação por fuso horário no frontend.
WITH limites AS (
  SELECT
    ((timezone('America/Sao_Paulo', now())::date)::timestamp AT TIME ZONE 'America/Sao_Paulo') AS inicio_hoje_brt,
    (((timezone('America/Sao_Paulo', now())::date + 1)::timestamp) AT TIME ZONE 'America/Sao_Paulo') AS inicio_amanha_brt
)
UPDATE public.publicacoes_djen_processos p
SET
  data_disponibilizacao = CASE
    WHEN p.data_disponibilizacao IS NOT NULL
      AND EXTRACT(HOUR FROM p.data_disponibilizacao AT TIME ZONE 'UTC') = 0
      AND EXTRACT(MINUTE FROM p.data_disponibilizacao AT TIME ZONE 'UTC') = 0
      AND floor(EXTRACT(SECOND FROM p.data_disponibilizacao AT TIME ZONE 'UTC')) = 0
    THEN (date_trunc('day', p.data_disponibilizacao AT TIME ZONE 'UTC') + interval '12 hours') AT TIME ZONE 'UTC'
    ELSE p.data_disponibilizacao
  END,
  data_publicacao = CASE
    WHEN p.data_publicacao IS NOT NULL
      AND EXTRACT(HOUR FROM p.data_publicacao AT TIME ZONE 'UTC') = 0
      AND EXTRACT(MINUTE FROM p.data_publicacao AT TIME ZONE 'UTC') = 0
      AND floor(EXTRACT(SECOND FROM p.data_publicacao AT TIME ZONE 'UTC')) = 0
    THEN (date_trunc('day', p.data_publicacao AT TIME ZONE 'UTC') + interval '12 hours') AT TIME ZONE 'UTC'
    ELSE p.data_publicacao
  END
FROM limites l
WHERE p.created_at >= l.inicio_hoje_brt
  AND p.created_at < l.inicio_amanha_brt
  AND (
    (p.data_disponibilizacao IS NOT NULL
      AND EXTRACT(HOUR FROM p.data_disponibilizacao AT TIME ZONE 'UTC') = 0
      AND EXTRACT(MINUTE FROM p.data_disponibilizacao AT TIME ZONE 'UTC') = 0
      AND floor(EXTRACT(SECOND FROM p.data_disponibilizacao AT TIME ZONE 'UTC')) = 0)
    OR
    (p.data_publicacao IS NOT NULL
      AND EXTRACT(HOUR FROM p.data_publicacao AT TIME ZONE 'UTC') = 0
      AND EXTRACT(MINUTE FROM p.data_publicacao AT TIME ZONE 'UTC') = 0
      AND floor(EXTRACT(SECOND FROM p.data_publicacao AT TIME ZONE 'UTC')) = 0)
  );

WITH limites AS (
  SELECT
    ((timezone('America/Sao_Paulo', now())::date)::timestamp AT TIME ZONE 'America/Sao_Paulo') AS inicio_hoje_brt,
    (((timezone('America/Sao_Paulo', now())::date + 1)::timestamp) AT TIME ZONE 'America/Sao_Paulo') AS inicio_amanha_brt
)
UPDATE public.publicacoes_djen p
SET
  data_disponibilizacao = CASE
    WHEN p.data_disponibilizacao IS NOT NULL
      AND EXTRACT(HOUR FROM p.data_disponibilizacao AT TIME ZONE 'UTC') = 0
      AND EXTRACT(MINUTE FROM p.data_disponibilizacao AT TIME ZONE 'UTC') = 0
      AND floor(EXTRACT(SECOND FROM p.data_disponibilizacao AT TIME ZONE 'UTC')) = 0
    THEN (date_trunc('day', p.data_disponibilizacao AT TIME ZONE 'UTC') + interval '12 hours') AT TIME ZONE 'UTC'
    ELSE p.data_disponibilizacao
  END,
  data_publicacao = CASE
    WHEN p.data_publicacao IS NOT NULL
      AND EXTRACT(HOUR FROM p.data_publicacao AT TIME ZONE 'UTC') = 0
      AND EXTRACT(MINUTE FROM p.data_publicacao AT TIME ZONE 'UTC') = 0
      AND floor(EXTRACT(SECOND FROM p.data_publicacao AT TIME ZONE 'UTC')) = 0
    THEN (date_trunc('day', p.data_publicacao AT TIME ZONE 'UTC') + interval '12 hours') AT TIME ZONE 'UTC'
    ELSE p.data_publicacao
  END
FROM limites l
WHERE p.created_at >= l.inicio_hoje_brt
  AND p.created_at < l.inicio_amanha_brt
  AND (
    (p.data_disponibilizacao IS NOT NULL
      AND EXTRACT(HOUR FROM p.data_disponibilizacao AT TIME ZONE 'UTC') = 0
      AND EXTRACT(MINUTE FROM p.data_disponibilizacao AT TIME ZONE 'UTC') = 0
      AND floor(EXTRACT(SECOND FROM p.data_disponibilizacao AT TIME ZONE 'UTC')) = 0)
    OR
    (p.data_publicacao IS NOT NULL
      AND EXTRACT(HOUR FROM p.data_publicacao AT TIME ZONE 'UTC') = 0
      AND EXTRACT(MINUTE FROM p.data_publicacao AT TIME ZONE 'UTC') = 0
      AND floor(EXTRACT(SECOND FROM p.data_publicacao AT TIME ZONE 'UTC')) = 0)
  );