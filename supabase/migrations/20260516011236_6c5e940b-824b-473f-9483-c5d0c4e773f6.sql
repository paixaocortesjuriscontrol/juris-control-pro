DROP INDEX IF EXISTS public.idx_publicacoes_djen_hash;
CREATE UNIQUE INDEX IF NOT EXISTS idx_publicacoes_djen_coord_hash
  ON public.publicacoes_djen (coordenacao_id, hash_conteudo)
  WHERE coordenacao_id IS NOT NULL;