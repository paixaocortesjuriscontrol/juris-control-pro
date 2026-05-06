-- Deduplica judit_anexos mantendo o melhor registro por (cnj, instance, nome, data, extensão)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY
        cnj,
        COALESCE(instance, ''),
        UPPER(TRIM(COALESCE(attachment_name, ''))),
        LEFT(COALESCE(attachment_date, ''), 10),
        LOWER(COALESCE(extension, ''))
      ORDER BY
        (storage_path IS NOT NULL) DESC,
        (documento_id IS NOT NULL) DESC,
        (texto_indexado IS TRUE) DESC,
        created_at ASC
    ) AS rn
  FROM public.judit_anexos
)
DELETE FROM public.judit_anexos a
USING ranked r
WHERE a.id = r.id AND r.rn > 1;

-- Índice único para impedir reinserção de duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS judit_anexos_dedup_uniq
ON public.judit_anexos (
  cnj,
  COALESCE(instance, ''),
  UPPER(TRIM(COALESCE(attachment_name, ''))),
  LEFT(COALESCE(attachment_date, ''), 10),
  LOWER(COALESCE(extension, ''))
);