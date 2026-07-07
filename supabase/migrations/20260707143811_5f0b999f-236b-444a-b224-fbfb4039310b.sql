-- Kurier deve deduplicar igual ao DJEN: 1 publicação por coordenação + id_kurier,
-- independente de quantos monitoramentos da coordenação tenham dado match.

-- 1) Remove duplicatas existentes do Kurier dentro da mesma coordenação.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY coordenacao_id, id_kurier
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.publicacoes_djen
  WHERE id_kurier IS NOT NULL
    AND coordenacao_id IS NOT NULL
)
DELETE FROM public.publicacoes_djen p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

-- 2) Remove o índice anterior, que ainda permitia duplicar quando mudava o monitoramento.
DROP INDEX IF EXISTS public.publicacoes_djen_kurier_dedup_idx;

-- 3) Cria o índice correto: uma publicação Kurier por coordenação.
CREATE UNIQUE INDEX IF NOT EXISTS publicacoes_djen_kurier_coord_unique_idx
  ON public.publicacoes_djen (coordenacao_id, id_kurier)
  WHERE id_kurier IS NOT NULL
    AND coordenacao_id IS NOT NULL;