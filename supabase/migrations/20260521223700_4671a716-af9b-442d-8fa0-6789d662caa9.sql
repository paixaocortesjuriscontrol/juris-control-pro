-- publicacoes_djen
DROP INDEX IF EXISTS public.idx_publicacoes_djen_coord_hash;
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_coord_hash_lookup
  ON public.publicacoes_djen (coordenacao_id, hash_conteudo)
  WHERE coordenacao_id IS NOT NULL;

-- publicacoes_djen_processos: drop the UNIQUE constraint (which owns the unique index)
ALTER TABLE public.publicacoes_djen_processos
  DROP CONSTRAINT IF EXISTS publicacoes_djen_processos_hash_unique;
-- idx_publicacoes_djen_processos_hash já é um índice btree comum sobre hash_conteudo

-- publicacoes_djen_descartadas
DROP INDEX IF EXISTS public.idx_publicacoes_djen_descartadas_hash;
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_descartadas_hash_lookup
  ON public.publicacoes_djen_descartadas (monitoramento_id, hash_conteudo);