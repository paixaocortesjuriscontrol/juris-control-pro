-- 1) Coluna id_kurier
ALTER TABLE public.publicacoes_djen ADD COLUMN IF NOT EXISTS id_kurier text;

-- 2) Backfill: pega o id_kurier a partir de kurier_publicacoes_raw
UPDATE public.publicacoes_djen p
SET id_kurier = r.id_kurier
FROM public.kurier_publicacoes_raw r
WHERE r.publicacao_djen_id = p.id
  AND p.id_kurier IS NULL
  AND r.id_kurier IS NOT NULL;

-- 3) Limpa duplicatas mantendo o mais antigo por (coord, monit, id_kurier)
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY coordenacao_id, monitoramento_id, id_kurier
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.publicacoes_djen
  WHERE id_kurier IS NOT NULL
    AND coordenacao_id IS NOT NULL
    AND monitoramento_id IS NOT NULL
)
DELETE FROM public.publicacoes_djen p
USING ranked r
WHERE p.id = r.id AND r.rn > 1;

-- 4) Índice único parcial equivalente ao (coord, monit, id_djen) do DJEN
CREATE UNIQUE INDEX IF NOT EXISTS publicacoes_djen_kurier_dedup_idx
  ON public.publicacoes_djen (coordenacao_id, monitoramento_id, id_kurier)
  WHERE id_kurier IS NOT NULL;