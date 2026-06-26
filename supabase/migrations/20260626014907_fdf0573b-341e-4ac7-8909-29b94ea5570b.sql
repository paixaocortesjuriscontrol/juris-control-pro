
ALTER TABLE public.publicacoes_djen ADD COLUMN IF NOT EXISTS execucao_id uuid;
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_execucao_id ON public.publicacoes_djen (execucao_id);

CREATE TABLE IF NOT EXISTS public.publicacoes_djen_execucoes (
  publicacao_id uuid NOT NULL,
  execucao_id uuid NOT NULL,
  tipo_engine text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (publicacao_id, execucao_id)
);

GRANT SELECT, INSERT ON public.publicacoes_djen_execucoes TO authenticated;
GRANT ALL ON public.publicacoes_djen_execucoes TO service_role;

ALTER TABLE public.publicacoes_djen_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read publicacoes_djen_execucoes"
  ON public.publicacoes_djen_execucoes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "auth insert publicacoes_djen_execucoes"
  ON public.publicacoes_djen_execucoes FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pde_execucao ON public.publicacoes_djen_execucoes (execucao_id);
CREATE INDEX IF NOT EXISTS idx_pde_publicacao ON public.publicacoes_djen_execucoes (publicacao_id);
