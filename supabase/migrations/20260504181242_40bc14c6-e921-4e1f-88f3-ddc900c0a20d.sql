
CREATE TABLE public.comentarios_publicacoes_djen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacao_id uuid NOT NULL REFERENCES public.publicacoes_djen(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  comentario text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comentarios_pub_djen_pub ON public.comentarios_publicacoes_djen(publicacao_id);
CREATE INDEX idx_comentarios_pub_djen_user ON public.comentarios_publicacoes_djen(user_id);

ALTER TABLE public.comentarios_publicacoes_djen ENABLE ROW LEVEL SECURITY;

-- Function: check if user shares a coordenação with the publicação's monitoramento
CREATE OR REPLACE FUNCTION public.user_can_access_publicacao_djen(_user_id uuid, _publicacao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.publicacoes_djen p
    JOIN public.monitoramentos_djen m ON m.id = p.monitoramento_id
    WHERE p.id = _publicacao_id
      AND (
        m.criado_por = _user_id
        OR (m.coordenacao_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.membros_coordenacao mc
          WHERE mc.coordenacao_id = m.coordenacao_id AND mc.usuario_id = _user_id
        ))
        OR public.has_role(_user_id, 'admin')
      )
  );
$$;

CREATE POLICY "Membros da coordenação podem ver comentários"
ON public.comentarios_publicacoes_djen FOR SELECT
TO authenticated
USING (public.user_can_access_publicacao_djen(auth.uid(), publicacao_id));

CREATE POLICY "Membros da coordenação podem inserir comentários"
ON public.comentarios_publicacoes_djen FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.user_can_access_publicacao_djen(auth.uid(), publicacao_id)
);

CREATE POLICY "Autor pode editar próprio comentário"
ON public.comentarios_publicacoes_djen FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Autor ou admin pode excluir comentário"
ON public.comentarios_publicacoes_djen FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_comentarios_pub_djen_updated
BEFORE UPDATE ON public.comentarios_publicacoes_djen
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
