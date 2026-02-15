-- Table to store full extracted document text, page by page, for indexed AI analysis
CREATE TABLE public.documentos_texto_indexado (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  documento_id UUID NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  pagina INTEGER NOT NULL,
  conteudo_texto TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups by document and process
CREATE INDEX idx_doc_texto_indexado_documento ON public.documentos_texto_indexado(documento_id);
CREATE INDEX idx_doc_texto_indexado_processo ON public.documentos_texto_indexado(processo_id);
CREATE UNIQUE INDEX idx_doc_texto_indexado_doc_pagina ON public.documentos_texto_indexado(documento_id, pagina);

-- Enable RLS
ALTER TABLE public.documentos_texto_indexado ENABLE ROW LEVEL SECURITY;

-- Policies - authenticated users can read/write
CREATE POLICY "Authenticated users can view indexed text"
  ON public.documentos_texto_indexado FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert indexed text"
  ON public.documentos_texto_indexado FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete indexed text"
  ON public.documentos_texto_indexado FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Add column to documentos to track if fully indexed
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS texto_completo_indexado BOOLEAN DEFAULT false;
