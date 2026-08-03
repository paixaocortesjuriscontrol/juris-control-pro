DROP POLICY IF EXISTS etiquetas_insert_gestores ON public.etiquetas;
DROP POLICY IF EXISTS etiquetas_update_gestores ON public.etiquetas;
DROP POLICY IF EXISTS etiquetas_delete_gestores ON public.etiquetas;

CREATE POLICY etiquetas_insert_membros ON public.etiquetas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_membro_coordenacao(coordenacao_id));

CREATE POLICY etiquetas_update_membros ON public.etiquetas
  FOR UPDATE TO authenticated
  USING (public.is_membro_coordenacao(coordenacao_id))
  WITH CHECK (public.is_membro_coordenacao(coordenacao_id));

CREATE POLICY etiquetas_delete_membros ON public.etiquetas
  FOR DELETE TO authenticated
  USING (public.is_membro_coordenacao(coordenacao_id));