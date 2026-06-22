
-- 1) Remove duplicates by (coordenacao_id, id_djen) keeping oldest
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY coordenacao_id, id_djen
    ORDER BY created_at ASC, id ASC
  ) rn
  FROM public.publicacoes_djen_servidor
  WHERE id_djen IS NOT NULL AND coordenacao_id IS NOT NULL
)
DELETE FROM public.publicacoes_djen_servidor p
USING ranked r
WHERE p.id = r.id AND r.rn > 1;

-- 2) Remove duplicates by (coordenacao_id, dedup_conteudo_key) for rows without id_djen
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY coordenacao_id, dedup_conteudo_key
    ORDER BY created_at ASC, id ASC
  ) rn
  FROM public.publicacoes_djen_servidor
  WHERE id_djen IS NULL AND dedup_conteudo_key IS NOT NULL AND coordenacao_id IS NOT NULL
)
DELETE FROM public.publicacoes_djen_servidor p
USING ranked r
WHERE p.id = r.id AND r.rn > 1;

-- 3) Drop the non-unique overlapping index and recreate as UNIQUE
DROP INDEX IF EXISTS public.idx_pub_djen_servidor_id_djen;
CREATE UNIQUE INDEX uq_pub_djen_servidor_coord_id_djen
  ON public.publicacoes_djen_servidor (coordenacao_id, id_djen)
  WHERE id_djen IS NOT NULL AND coordenacao_id IS NOT NULL;

DROP INDEX IF EXISTS public.idx_pub_djen_servidor_conteudo_key;
CREATE UNIQUE INDEX uq_pub_djen_servidor_coord_conteudo_key
  ON public.publicacoes_djen_servidor (coordenacao_id, dedup_conteudo_key)
  WHERE id_djen IS NULL AND dedup_conteudo_key IS NOT NULL AND coordenacao_id IS NOT NULL;
