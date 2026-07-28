DROP POLICY IF EXISTS "Coordenadores e admins podem visualizar configs de alertas" ON public.config_alertas_coordenacao;
DROP POLICY IF EXISTS "Admins coordenadores e assistentes podem atualizar configs de a" ON public.config_alertas_coordenacao;
DROP POLICY IF EXISTS "Admins coordenadores e assistentes podem criar configs de alert" ON public.config_alertas_coordenacao;

CREATE POLICY "config_alertas_select"
ON public.config_alertas_coordenacao
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'coordenador'::app_role)
  OR public.has_role(auth.uid(), 'assistente_coordenador'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.membros_coordenacao mc
    WHERE mc.usuario_id = auth.uid()
      AND mc.coordenacao_id = config_alertas_coordenacao.coordenacao_id
  )
);

CREATE POLICY "config_alertas_insert"
ON public.config_alertas_coordenacao
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'coordenador'::app_role)
  OR public.has_role(auth.uid(), 'assistente_coordenador'::app_role)
);

CREATE POLICY "config_alertas_update"
ON public.config_alertas_coordenacao
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'coordenador'::app_role)
  OR public.has_role(auth.uid(), 'assistente_coordenador'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'coordenador'::app_role)
  OR public.has_role(auth.uid(), 'assistente_coordenador'::app_role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_alertas_coordenacao TO authenticated;
GRANT ALL ON public.config_alertas_coordenacao TO service_role;