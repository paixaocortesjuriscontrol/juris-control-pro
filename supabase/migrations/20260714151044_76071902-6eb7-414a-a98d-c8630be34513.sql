
-- Junção audiência ↔ publicação (origem termo)
CREATE TABLE public.audiencias_publicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audiencia_id uuid NOT NULL REFERENCES public.audiencias_detectadas(id) ON DELETE CASCADE,
  publicacao_id uuid NOT NULL REFERENCES public.publicacoes_djen(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (audiencia_id, publicacao_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audiencias_publicacoes TO authenticated;
GRANT ALL ON public.audiencias_publicacoes TO service_role;
ALTER TABLE public.audiencias_publicacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários autenticados podem ver vínculos audiência-publicação"
  ON public.audiencias_publicacoes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Usuários autenticados podem criar vínculos audiência-publicação"
  ON public.audiencias_publicacoes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Usuários autenticados podem deletar vínculos audiência-publicação"
  ON public.audiencias_publicacoes FOR DELETE USING (auth.uid() IS NOT NULL);
CREATE INDEX idx_audiencias_publicacoes_audiencia ON public.audiencias_publicacoes(audiencia_id);
CREATE INDEX idx_audiencias_publicacoes_publicacao ON public.audiencias_publicacoes(publicacao_id);

-- Junção audiência ↔ publicação (origem processo)
CREATE TABLE public.audiencias_publicacoes_processos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audiencia_id uuid NOT NULL REFERENCES public.audiencias_detectadas(id) ON DELETE CASCADE,
  publicacao_processo_id uuid NOT NULL REFERENCES public.publicacoes_djen_processos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (audiencia_id, publicacao_processo_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audiencias_publicacoes_processos TO authenticated;
GRANT ALL ON public.audiencias_publicacoes_processos TO service_role;
ALTER TABLE public.audiencias_publicacoes_processos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários autenticados podem ver vínculos audiência-pub-proc"
  ON public.audiencias_publicacoes_processos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Usuários autenticados podem criar vínculos audiência-pub-proc"
  ON public.audiencias_publicacoes_processos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Usuários autenticados podem deletar vínculos audiência-pub-proc"
  ON public.audiencias_publicacoes_processos FOR DELETE USING (auth.uid() IS NOT NULL);
CREATE INDEX idx_audiencias_pub_proc_audiencia ON public.audiencias_publicacoes_processos(audiencia_id);
CREATE INDEX idx_audiencias_pub_proc_publicacao ON public.audiencias_publicacoes_processos(publicacao_processo_id);

-- Junção audiência ↔ publicação descartada
CREATE TABLE public.audiencias_publicacoes_descartadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audiencia_id uuid NOT NULL REFERENCES public.audiencias_detectadas(id) ON DELETE CASCADE,
  publicacao_descartada_id uuid NOT NULL REFERENCES public.publicacoes_djen_descartadas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (audiencia_id, publicacao_descartada_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audiencias_publicacoes_descartadas TO authenticated;
GRANT ALL ON public.audiencias_publicacoes_descartadas TO service_role;
ALTER TABLE public.audiencias_publicacoes_descartadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários autenticados podem ver vínculos audiência-desc"
  ON public.audiencias_publicacoes_descartadas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Usuários autenticados podem criar vínculos audiência-desc"
  ON public.audiencias_publicacoes_descartadas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Usuários autenticados podem deletar vínculos audiência-desc"
  ON public.audiencias_publicacoes_descartadas FOR DELETE USING (auth.uid() IS NOT NULL);
CREATE INDEX idx_audiencias_pub_desc_audiencia ON public.audiencias_publicacoes_descartadas(audiencia_id);
CREATE INDEX idx_audiencias_pub_desc_publicacao ON public.audiencias_publicacoes_descartadas(publicacao_descartada_id);
