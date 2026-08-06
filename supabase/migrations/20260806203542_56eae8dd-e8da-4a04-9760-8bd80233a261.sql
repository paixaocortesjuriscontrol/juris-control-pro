ALTER TABLE public.processo_tags_catalogo ADD COLUMN IF NOT EXISTS publica boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "Tags catalogo: read by authenticated" ON public.processo_tags_catalogo;
CREATE POLICY "Tags catalogo: read publicas ou admin"
ON public.processo_tags_catalogo
FOR SELECT
TO authenticated
USING (publica OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.atualizar_visibilidade_processo_tag(_tag_id uuid, _publica boolean)
RETURNS TABLE(id uuid, publica boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar a visibilidade da TAG';
  END IF;
  RETURN QUERY
  UPDATE public.processo_tags_catalogo t
     SET publica = _publica
   WHERE t.id = _tag_id
  RETURNING t.id, t.publica;
END;
$$;

GRANT EXECUTE ON FUNCTION public.atualizar_visibilidade_processo_tag(uuid, boolean) TO authenticated;