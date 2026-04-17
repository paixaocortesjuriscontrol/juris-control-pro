
-- 1. Renomear data_distribuicao -> data_distribuicao_planilha
ALTER TABLE public.dados_benner RENAME COLUMN data_distribuicao TO data_distribuicao_planilha;

-- 2. Adicionar data_distribuicao_real
ALTER TABLE public.dados_benner ADD COLUMN IF NOT EXISTS data_distribuicao_real date;

-- 3. Tabela de responsáveis múltiplos
CREATE TABLE IF NOT EXISTS public.dados_benner_responsaveis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dados_benner_id uuid NOT NULL REFERENCES public.dados_benner(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dados_benner_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_dbr_dados_benner_id ON public.dados_benner_responsaveis(dados_benner_id);
CREATE INDEX IF NOT EXISTS idx_dbr_usuario_id ON public.dados_benner_responsaveis(usuario_id);

ALTER TABLE public.dados_benner_responsaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read responsaveis"
ON public.dados_benner_responsaveis FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated can insert responsaveis"
ON public.dados_benner_responsaveis FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update responsaveis"
ON public.dados_benner_responsaveis FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete responsaveis"
ON public.dados_benner_responsaveis FOR DELETE
TO authenticated USING (true);
