CREATE OR REPLACE FUNCTION public.coordenadores_que_recebem_avisos(_coordenacao_id uuid)
RETURNS TABLE(usuario_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.coordenador_id
  FROM public.coordenacoes c
  WHERE c.id = _coordenacao_id
    AND c.coordenador_id IS NOT NULL
    AND (public.is_member_of_coordenacao(auth.uid(), _coordenacao_id)
         OR public.is_admin_or_coordenador(auth.uid())
         OR public.has_role(auth.uid(), 'admin'))
  UNION
  SELECT m.usuario_id
  FROM public.membros_coordenacao m
  JOIN public.user_roles r
    ON r.user_id = m.usuario_id
   AND r.role IN ('coordenador', 'assistente_coordenador')
  WHERE m.coordenacao_id = _coordenacao_id
    AND (public.is_member_of_coordenacao(auth.uid(), _coordenacao_id)
         OR public.is_admin_or_coordenador(auth.uid())
         OR public.has_role(auth.uid(), 'admin'))
$$;

REVOKE ALL ON FUNCTION public.coordenadores_que_recebem_avisos(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coordenadores_que_recebem_avisos(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.coordenadores_que_recebem_avisos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coordenadores_que_recebem_avisos(uuid) TO service_role;