-- Drop existing SELECT policy for resumos_monitoramento_djen
DROP POLICY IF EXISTS "Users can view resumos of own monitoramentos" ON public.resumos_monitoramento_djen;

-- Create new SELECT policy that allows users to see resumos from:
-- 1. Monitoramentos they created
-- 2. Monitoramentos from coordenações they belong to
-- 3. All if admin/coordenador
CREATE POLICY "Users can view accessible resumos"
ON public.resumos_monitoramento_djen
FOR SELECT
USING (
  monitoramento_id IN (
    SELECT id FROM monitoramentos_djen 
    WHERE 
      criado_por = auth.uid() OR 
      is_admin_or_coordenador(auth.uid()) OR
      coordenacao_id IN (
        SELECT coordenacao_id FROM membros_coordenacao WHERE usuario_id = auth.uid()
      )
  )
);

-- Also update the DELETE policy to match
DROP POLICY IF EXISTS "Users can delete resumos of own monitoramentos" ON public.resumos_monitoramento_djen;

CREATE POLICY "Users can delete accessible resumos"
ON public.resumos_monitoramento_djen
FOR DELETE
USING (
  monitoramento_id IN (
    SELECT id FROM monitoramentos_djen 
    WHERE 
      criado_por = auth.uid() OR 
      is_admin_or_coordenador(auth.uid()) OR
      coordenacao_id IN (
        SELECT coordenacao_id FROM membros_coordenacao WHERE usuario_id = auth.uid()
      )
  )
);