CREATE OR REPLACE FUNCTION public.can_manage_coordenacao_members(_user_id uuid, _coordenacao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.coordenacoes c
      WHERE c.id = _coordenacao_id
        AND c.coordenador_id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.membros_coordenacao mc
      WHERE mc.coordenacao_id = _coordenacao_id
        AND mc.usuario_id = _user_id
        AND lower(replace(unaccent(coalesce(mc.cargo, '')), ' ', '_')) IN ('coordenador', 'assistente_coordenador')
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_coordenacao_members(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_coordenacao_members(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_coordenacao_members(uuid, uuid) TO service_role;

DROP POLICY IF EXISTS "Admins and coordenadores can manage membros" ON public.membros_coordenacao;
DROP POLICY IF EXISTS "Managers can insert membros" ON public.membros_coordenacao;
DROP POLICY IF EXISTS "Managers can update membros" ON public.membros_coordenacao;
DROP POLICY IF EXISTS "Managers can delete membros" ON public.membros_coordenacao;

CREATE POLICY "Managers can insert membros"
ON public.membros_coordenacao
FOR INSERT TO authenticated
WITH CHECK (public.can_manage_coordenacao_members(auth.uid(), coordenacao_id));

CREATE POLICY "Managers can update membros"
ON public.membros_coordenacao
FOR UPDATE TO authenticated
USING (public.can_manage_coordenacao_members(auth.uid(), coordenacao_id))
WITH CHECK (public.can_manage_coordenacao_members(auth.uid(), coordenacao_id));

CREATE POLICY "Managers can delete membros"
ON public.membros_coordenacao
FOR DELETE TO authenticated
USING (public.can_manage_coordenacao_members(auth.uid(), coordenacao_id));