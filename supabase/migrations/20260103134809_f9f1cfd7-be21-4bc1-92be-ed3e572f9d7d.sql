-- Fix infinite recursion in agenda RLS by using SECURITY DEFINER helpers

-- Helper: can the user access an event (creator, participant, or admin/coordinator)?
CREATE OR REPLACE FUNCTION public.can_access_evento(_user_id uuid, _evento_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin_or_coordenador(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.eventos_agenda e
      WHERE e.id = _evento_id
        AND e.criado_por = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.participantes_evento pe
      WHERE pe.evento_id = _evento_id
        AND pe.usuario_id = _user_id
    );
$$;

-- Helper: can the user manage an event (creator or admin/coordinator)?
CREATE OR REPLACE FUNCTION public.can_manage_evento(_user_id uuid, _evento_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin_or_coordenador(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.eventos_agenda e
      WHERE e.id = _evento_id
        AND e.criado_por = _user_id
    );
$$;

-- Ensure RLS is enabled
ALTER TABLE public.eventos_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participantes_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_evento ENABLE ROW LEVEL SECURITY;

-- =====================
-- eventos_agenda policies
-- =====================
DROP POLICY IF EXISTS "Users can view accessible events" ON public.eventos_agenda;
DROP POLICY IF EXISTS "Users can create events" ON public.eventos_agenda;
DROP POLICY IF EXISTS "Users can update own events or admins" ON public.eventos_agenda;
DROP POLICY IF EXISTS "Users can delete own events or admins" ON public.eventos_agenda;

CREATE POLICY "Agenda: view events"
ON public.eventos_agenda
FOR SELECT
TO authenticated
USING (public.can_access_evento(auth.uid(), id));

CREATE POLICY "Agenda: create events"
ON public.eventos_agenda
FOR INSERT
TO authenticated
WITH CHECK (criado_por = auth.uid());

CREATE POLICY "Agenda: update events"
ON public.eventos_agenda
FOR UPDATE
TO authenticated
USING (public.can_manage_evento(auth.uid(), id))
WITH CHECK (public.can_manage_evento(auth.uid(), id));

CREATE POLICY "Agenda: delete events"
ON public.eventos_agenda
FOR DELETE
TO authenticated
USING (public.can_manage_evento(auth.uid(), id));

-- ===========================
-- participantes_evento policies
-- ===========================
DROP POLICY IF EXISTS "Event creators can manage participants" ON public.participantes_evento;
DROP POLICY IF EXISTS "Users can view participants of accessible events" ON public.participantes_evento;

CREATE POLICY "Agenda: view participants"
ON public.participantes_evento
FOR SELECT
TO authenticated
USING (public.can_access_evento(auth.uid(), evento_id));

CREATE POLICY "Agenda: manage participants"
ON public.participantes_evento
FOR ALL
TO authenticated
USING (public.can_manage_evento(auth.uid(), evento_id))
WITH CHECK (public.can_manage_evento(auth.uid(), evento_id));

-- ======================
-- alertas_evento policies
-- ======================
DROP POLICY IF EXISTS "Event creators can manage alerts" ON public.alertas_evento;
DROP POLICY IF EXISTS "Users can view alerts for their events" ON public.alertas_evento;

CREATE POLICY "Agenda: view alerts"
ON public.alertas_evento
FOR SELECT
TO authenticated
USING (public.can_access_evento(auth.uid(), evento_id));

CREATE POLICY "Agenda: manage alerts"
ON public.alertas_evento
FOR ALL
TO authenticated
USING (public.can_manage_evento(auth.uid(), evento_id))
WITH CHECK (public.can_manage_evento(auth.uid(), evento_id));
