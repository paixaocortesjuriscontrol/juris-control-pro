-- Drop existing policies
DROP POLICY IF EXISTS "Users can create comments on accessible tasks" ON public.comentarios_prazos;
DROP POLICY IF EXISTS "Users can view comments on accessible tasks" ON public.comentarios_prazos;

-- Create new INSERT policy that handles tasks with or without process
CREATE POLICY "Users can create comments on accessible tasks" 
ON public.comentarios_prazos 
FOR INSERT 
WITH CHECK (
  autor_id = auth.uid() 
  AND (
    -- Task with process - user must have access to the process
    prazo_id IN (
      SELECT p.id FROM prazos p 
      WHERE p.processo_id IS NOT NULL 
      AND can_access_processo(auth.uid(), p.processo_id)
    )
    OR
    -- Task without process - user must be the responsible or admin/coordinator
    prazo_id IN (
      SELECT p.id FROM prazos p 
      WHERE p.processo_id IS NULL 
      AND (p.responsavel_id = auth.uid() OR is_admin_or_coordenador(auth.uid()))
    )
  )
);

-- Create new SELECT policy that handles tasks with or without process
CREATE POLICY "Users can view comments on accessible tasks" 
ON public.comentarios_prazos 
FOR SELECT 
USING (
  -- Task with process - user must have access to the process
  prazo_id IN (
    SELECT p.id FROM prazos p 
    WHERE p.processo_id IS NOT NULL 
    AND can_access_processo(auth.uid(), p.processo_id)
  )
  OR
  -- Task without process - user must be the responsible or admin/coordinator
  prazo_id IN (
    SELECT p.id FROM prazos p 
    WHERE p.processo_id IS NULL 
    AND (p.responsavel_id = auth.uid() OR is_admin_or_coordenador(auth.uid()))
  )
);