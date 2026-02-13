ALTER TABLE public.documentos
  ADD COLUMN conteudo_extraido text,
  ADD COLUMN paginas_extraidas integer DEFAULT 0;