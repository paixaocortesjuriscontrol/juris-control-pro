WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY processo, dossie
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.dados_benner
  WHERE processo IS NOT NULL
    AND btrim(processo) <> ''
    AND dossie IS NOT NULL
    AND btrim(dossie) <> ''
), to_delete AS (
  SELECT id
  FROM ranked
  WHERE rn > 1
)
DELETE FROM public.dados_benner
WHERE id IN (SELECT id FROM to_delete);