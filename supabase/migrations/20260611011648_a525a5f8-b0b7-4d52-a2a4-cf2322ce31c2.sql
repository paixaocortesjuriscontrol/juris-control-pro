CREATE TABLE public.comentarios_audiencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audiencia_id UUID NOT NULL REFERENCES public.audiencias_detectadas(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL,
  conteudo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comentarios_audiencias TO authenticated;
GRANT ALL ON public.comentarios_audiencias TO service_role;

ALTER TABLE public.comentarios_audiencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver comentarios de audiencias visiveis"
  ON public.comentarios_audiencias FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.audiencias_detectadas a
      WHERE a.id = comentarios_audiencias.audiencia_id
        AND (
          a.criado_por = auth.uid()
          OR EXISTS (SELECT 1 FROM public.audiencias_advogados aa WHERE aa.audiencia_id = a.id AND aa.advogado_id = auth.uid())
          OR EXISTS (SELECT 1 FROM public.audiencia_envolvidos ae WHERE ae.audiencia_id = a.id AND ae.usuario_id = auth.uid())
        )
    )
  );

CREATE POLICY "Criar comentarios audiencia como autor"
  ON public.comentarios_audiencias FOR INSERT
  TO authenticated
  WITH CHECK (autor_id = auth.uid());

CREATE POLICY "Editar proprio comentario audiencia"
  ON public.comentarios_audiencias FOR UPDATE
  TO authenticated
  USING (autor_id = auth.uid())
  WITH CHECK (autor_id = auth.uid());

CREATE POLICY "Excluir proprio comentario audiencia"
  ON public.comentarios_audiencias FOR DELETE
  TO authenticated
  USING (autor_id = auth.uid());

CREATE INDEX idx_comentarios_audiencias_audiencia ON public.comentarios_audiencias(audiencia_id, created_at);

CREATE TRIGGER update_comentarios_audiencias_updated_at
  BEFORE UPDATE ON public.comentarios_audiencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();