ALTER TABLE public.judit_anexos
  ADD COLUMN IF NOT EXISTS texto_indexado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paginas_extraidas integer,
  ADD COLUMN IF NOT EXISTS documento_id uuid,
  ADD COLUMN IF NOT EXISTS processo_id uuid,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS texto_indexado_em timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_judit_anexos_documento_id ON public.judit_anexos(documento_id);
CREATE INDEX IF NOT EXISTS idx_judit_anexos_processo_numero ON public.judit_anexos(processo_numero);