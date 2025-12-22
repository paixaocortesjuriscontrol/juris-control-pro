-- Drop existing policies for monitoramentos_djen
DROP POLICY IF EXISTS "Users can view own monitoramentos" ON public.monitoramentos_djen;

-- Create new SELECT policy that allows users to see:
-- 1. Monitoramentos they created
-- 2. Monitoramentos from coordenações they belong to
-- 3. All if admin/coordenador
CREATE POLICY "Users can view accessible monitoramentos"
ON public.monitoramentos_djen
FOR SELECT
USING (
  (criado_por = auth.uid()) OR 
  is_admin_or_coordenador(auth.uid()) OR
  (coordenacao_id IN (
    SELECT coordenacao_id FROM membros_coordenacao WHERE usuario_id = auth.uid()
  ))
);