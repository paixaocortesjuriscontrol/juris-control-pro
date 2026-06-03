ALTER TABLE public.publicacoes_djen_global_hash
ADD COLUMN IF NOT EXISTS escopo_dedup TEXT;

UPDATE public.publicacoes_djen_global_hash gh
SET escopo_dedup = COALESCE('coord:' || md.coordenacao_id::text, 'mon:' || gh.primeiro_monitoramento_id::text)
FROM public.monitoramentos_djen md
WHERE gh.primeiro_monitoramento_id = md.id
  AND gh.escopo_dedup IS NULL;

UPDATE public.publicacoes_djen_global_hash
SET escopo_dedup = 'mon:' || COALESCE(primeiro_monitoramento_id::text, id::text)
WHERE escopo_dedup IS NULL;

ALTER TABLE public.publicacoes_djen_global_hash
ALTER COLUMN escopo_dedup SET NOT NULL;

ALTER TABLE public.publicacoes_djen_global_hash
DROP CONSTRAINT IF EXISTS publicacoes_djen_global_hash_hash_global_key;

DROP INDEX IF EXISTS public.idx_publicacoes_djen_global_hash_lookup;

CREATE UNIQUE INDEX IF NOT EXISTS idx_publicacoes_djen_global_hash_scope
ON public.publicacoes_djen_global_hash(escopo_dedup, hash_global);

CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_global_hash_hash
ON public.publicacoes_djen_global_hash(hash_global);