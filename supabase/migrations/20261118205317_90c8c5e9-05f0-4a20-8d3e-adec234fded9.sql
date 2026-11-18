CREATE OR REPLACE FUNCTION public._pode_gerir_coordenacao(_coord uuid)
 RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public'
AS $f$
  select public.has_role(auth.uid(),'admin') or exists(
    select 1 from membros_coordenacao m where m.coordenacao_id=_coord and m.usuario_id=auth.uid()
      and public.normalizar_cargo_perfil(m.cargo) in ('coordenador','assistente_coordenador'))
$f$;

CREATE OR REPLACE FUNCTION public.coordenadores_da_coordenacao(_coordenacao_id uuid)
 RETURNS TABLE(usuario_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
  SELECT c.coordenador_id FROM public.coordenacoes c
  WHERE c.id = _coordenacao_id AND c.coordenador_id IS NOT NULL
  UNION
  SELECT m.usuario_id FROM public.membros_coordenacao m
  WHERE m.coordenacao_id = _coordenacao_id
    AND public.normalizar_cargo_perfil(m.cargo) IN ('coordenador','assistente_coordenador')
$f$;

CREATE OR REPLACE FUNCTION public.pode_arquivar_workflow(_workflow_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $f$
  SELECT has_role(auth.uid(),'admin') OR EXISTS (
    SELECT 1 FROM workflows w WHERE w.id = _workflow_id AND (
      EXISTS (SELECT 1 FROM coordenacoes c WHERE c.id = w.coordenacao_id AND c.coordenador_id = auth.uid())
      OR EXISTS (SELECT 1 FROM membros_coordenacao m WHERE m.coordenacao_id = w.coordenacao_id
                 AND m.usuario_id = auth.uid() AND public.normalizar_cargo_perfil(m.cargo) = 'coordenador')))
$f$;

CREATE OR REPLACE FUNCTION app_private.can_manage_coordenacao_members(_user_id uuid, _coordenacao_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $f$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.coordenacoes c WHERE c.id = _coordenacao_id AND c.coordenador_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.membros_coordenacao mc
      WHERE mc.coordenacao_id = _coordenacao_id AND mc.usuario_id = _user_id
        AND public.normalizar_cargo_perfil(mc.cargo) IN ('coordenador', 'assistente_coordenador'));
$f$;