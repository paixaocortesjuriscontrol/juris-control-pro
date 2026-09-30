DROP POLICY IF EXISTS "Tags catalogo: read publicas ou admin" ON public.processo_tags_catalogo;
CREATE POLICY "Tags catalogo: read publicas ou admin/coord" ON public.processo_tags_catalogo FOR SELECT TO authenticated
USING (publica OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador') OR has_role(auth.uid(),'assistente_coordenador'));
DROP POLICY IF EXISTS "Tags catalogo: admin/coord update" ON public.processo_tags_catalogo;
CREATE POLICY "Tags catalogo: admin/coord update" ON public.processo_tags_catalogo FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador') OR has_role(auth.uid(),'assistente_coordenador'));
DROP POLICY IF EXISTS "Tags catalogo: admin/coord delete" ON public.processo_tags_catalogo;
CREATE POLICY "Tags catalogo: admin/coord delete" ON public.processo_tags_catalogo FOR DELETE TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador') OR has_role(auth.uid(),'assistente_coordenador'));
DROP POLICY IF EXISTS "Tags catalogo: admin/coord insert" ON public.processo_tags_catalogo;
CREATE POLICY "Tags catalogo: admin/coord insert" ON public.processo_tags_catalogo FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador') OR has_role(auth.uid(),'assistente_coordenador'));
DROP POLICY IF EXISTS "DB tags: admin/coord delete" ON public.dados_benner_processo_tags;
CREATE POLICY "DB tags: admin/coord delete" ON public.dados_benner_processo_tags FOR DELETE TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador') OR has_role(auth.uid(),'assistente_coordenador'));
DROP POLICY IF EXISTS "DB tags: admin/coord insert" ON public.dados_benner_processo_tags;
CREATE POLICY "DB tags: admin/coord insert" ON public.dados_benner_processo_tags FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador') OR has_role(auth.uid(),'assistente_coordenador'));
CREATE OR REPLACE FUNCTION public.atualizar_visibilidade_processo_tag(_tag_id uuid, _publica boolean)
 RETURNS TABLE(id uuid, publica boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador') OR has_role(auth.uid(),'assistente_coordenador')) THEN
    RAISE EXCEPTION 'Apenas administradores e coordenadores podem alterar a visibilidade da TAG';
  END IF;
  RETURN QUERY UPDATE public.processo_tags_catalogo t SET publica = _publica WHERE t.id = _tag_id RETURNING t.id, t.publica;
END; $$;