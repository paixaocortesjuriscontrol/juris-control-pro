-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view events they created or participate in" ON eventos_agenda;
DROP POLICY IF EXISTS "Users can create events" ON eventos_agenda;
DROP POLICY IF EXISTS "Users can update own events or admins" ON eventos_agenda;
DROP POLICY IF EXISTS "Users can delete own events or admins" ON eventos_agenda;

-- Recreate policies without recursive subqueries
-- For SELECT: allow if user created the event, is a participant, or is admin/coordinator
CREATE POLICY "Users can view accessible events" 
ON eventos_agenda 
FOR SELECT 
USING (
  criado_por = auth.uid() 
  OR is_admin_or_coordenador(auth.uid())
  OR EXISTS (
    SELECT 1 FROM participantes_evento pe 
    WHERE pe.evento_id = eventos_agenda.id 
    AND pe.usuario_id = auth.uid()
  )
);

-- For INSERT: only the creator can insert
CREATE POLICY "Users can create events" 
ON eventos_agenda 
FOR INSERT 
WITH CHECK (criado_por = auth.uid());

-- For UPDATE: creator or admin/coordinator
CREATE POLICY "Users can update own events or admins" 
ON eventos_agenda 
FOR UPDATE 
USING (criado_por = auth.uid() OR is_admin_or_coordenador(auth.uid()));

-- For DELETE: creator or admin/coordinator  
CREATE POLICY "Users can delete own events or admins" 
ON eventos_agenda 
FOR DELETE 
USING (criado_por = auth.uid() OR is_admin_or_coordenador(auth.uid()));