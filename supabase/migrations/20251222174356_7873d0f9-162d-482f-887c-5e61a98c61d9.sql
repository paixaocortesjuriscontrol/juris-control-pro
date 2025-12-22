-- Drop existing SELECT policy for publicacoes_djen
DROP POLICY IF EXISTS "Users can view publicacoes of own monitoramentos" ON public.publicacoes_djen;

-- Create new SELECT policy that allows users to see publications from:
-- 1. Monitoramentos they created
-- 2. Monitoramentos from coordenações they belong to
-- 3. All if admin/coordenador
CREATE POLICY "Users can view accessible publicacoes"
ON public.publicacoes_djen
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

-- Also update the UPDATE policy to match
DROP POLICY IF EXISTS "Users can update publicacoes of own monitoramentos" ON public.publicacoes_djen;

CREATE POLICY "Users can update accessible publicacoes"
ON public.publicacoes_djen
FOR UPDATE
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