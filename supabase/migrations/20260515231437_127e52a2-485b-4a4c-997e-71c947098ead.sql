-- Tabela de PDFs baixados dos diários estaduais
CREATE TABLE public.dj_estaduais_pdfs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tribunal TEXT NOT NULL,
  data_publicacao DATE NOT NULL,
  caderno TEXT NOT NULL DEFAULT 'judicial',
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  total_paginas INTEGER,
  erro_mensagem TEXT,
  baixado_em TIMESTAMPTZ,
  processado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tribunal, data_publicacao, caderno)
);

CREATE INDEX idx_dj_estaduais_pdfs_status ON public.dj_estaduais_pdfs (status);
CREATE INDEX idx_dj_estaduais_pdfs_tribunal_data ON public.dj_estaduais_pdfs (tribunal, data_publicacao DESC);

ALTER TABLE public.dj_estaduais_pdfs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dj_estaduais_pdfs_select_authenticated"
  ON public.dj_estaduais_pdfs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "dj_estaduais_pdfs_service_role_all"
  ON public.dj_estaduais_pdfs FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Tabela de conteúdo indexado por página
CREATE TABLE public.dj_estaduais_conteudo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pdf_id UUID NOT NULL REFERENCES public.dj_estaduais_pdfs(id) ON DELETE CASCADE,
  pagina INTEGER NOT NULL,
  conteudo_texto TEXT NOT NULL,
  processos_detectados TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pdf_id, pagina)
);

CREATE INDEX idx_dj_estaduais_conteudo_pdf ON public.dj_estaduais_conteudo (pdf_id);
CREATE INDEX idx_dj_estaduais_conteudo_processos ON public.dj_estaduais_conteudo USING GIN (processos_detectados);
CREATE INDEX idx_dj_estaduais_conteudo_fts ON public.dj_estaduais_conteudo USING GIN (to_tsvector('portuguese', conteudo_texto));

ALTER TABLE public.dj_estaduais_conteudo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dj_estaduais_conteudo_select_authenticated"
  ON public.dj_estaduais_conteudo FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "dj_estaduais_conteudo_service_role_all"
  ON public.dj_estaduais_conteudo FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER update_dj_estaduais_pdfs_updated_at
  BEFORE UPDATE ON public.dj_estaduais_pdfs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado para PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('dj-estaduais-pdfs', 'dj-estaduais-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Policies de storage
CREATE POLICY "dj_estaduais_pdfs_storage_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'dj-estaduais-pdfs');

CREATE POLICY "dj_estaduais_pdfs_storage_service_role"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'dj-estaduais-pdfs')
  WITH CHECK (bucket_id = 'dj-estaduais-pdfs');