DROP POLICY IF EXISTS eventos_agenda_select_scoped ON public.eventos_agenda;
CREATE POLICY eventos_agenda_select_scoped ON public.eventos_agenda FOR SELECT TO authenticated
USING (
  criado_por = (SELECT auth.uid())
  OR (SELECT public.is_admin_or_coordenador(auth.uid()))
  OR public.can_access_evento((SELECT auth.uid()), id)
);