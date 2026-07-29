ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS evento_id uuid REFERENCES public.eventos_agenda(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS audiencia_id uuid REFERENCES public.audiencias_detectadas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_documentos_evento_id ON public.documentos(evento_id);
CREATE INDEX IF NOT EXISTS idx_documentos_audiencia_id ON public.documentos(audiencia_id);