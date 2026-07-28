DROP POLICY IF EXISTS "Coordenadores e admins podem criar configs de alertas" ON public.config_alertas_coordenacao;
DROP POLICY IF EXISTS "Coordenadores e admins podem atualizar configs de alertas" ON public.config_alertas_coordenacao;

CREATE POLICY "Admins coordenadores e assistentes podem criar configs de alertas"
ON public.config_alertas_coordenacao
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'coordenador'::public.app_role)
);

CREATE POLICY "Admins coordenadores e assistentes podem atualizar configs de alertas"
ON public.config_alertas_coordenacao
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'coordenador'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'coordenador'::public.app_role)
);