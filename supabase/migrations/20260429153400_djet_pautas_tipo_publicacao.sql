-- DJET Pautas Paralela: marca o tipo de publicação para separar
-- pautas (DEJT) das intimações (PJe Comunica). Retrocompatível.

ALTER TABLE public.publicacoes_djen
  ADD COLUMN IF NOT EXISTS tipo_publicacao text NOT NULL DEFAULT 'intimacao';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'publicacoes_djen_tipo_publicacao_check'
  ) THEN
    ALTER TABLE public.publicacoes_djen
      ADD CONSTRAINT publicacoes_djen_tipo_publicacao_check
      CHECK (tipo_publicacao IN ('intimacao', 'pauta'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_tipo_pub_data
  ON public.publicacoes_djen (monitoramento_id, tipo_publicacao, data_publicacao DESC);
