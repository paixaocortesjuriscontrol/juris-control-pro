-- 1) Remove unique(id_kurier) — cada item Kurier pode gerar múltiplas linhas raw
ALTER TABLE public.kurier_publicacoes_raw
  DROP CONSTRAINT IF EXISTS kurier_publicacoes_raw_id_kurier_key;

-- 2) Índice composto para upserts/lookups (não-único)
CREATE INDEX IF NOT EXISTS idx_kurier_pub_raw_idk_cred_pub
  ON public.kurier_publicacoes_raw (id_kurier, credencial_id, publicacao_djen_id);

-- 3) Índice por login para relatórios "quantas publicações por login"
CREATE INDEX IF NOT EXISTS idx_kurier_pub_raw_login_usado
  ON public.kurier_publicacoes_raw (login_usado);

-- 4) Índice auxiliar para varreduras por publicacao_djen_id (join publicacoes_djen)
CREATE INDEX IF NOT EXISTS idx_kurier_pub_raw_pub_djen
  ON public.kurier_publicacoes_raw (publicacao_djen_id)
  WHERE publicacao_djen_id IS NOT NULL;