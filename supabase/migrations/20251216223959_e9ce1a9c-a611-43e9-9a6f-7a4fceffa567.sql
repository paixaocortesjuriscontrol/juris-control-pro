-- Drop existing RLS policies on prazos
DROP POLICY IF EXISTS "Users can manage prazos of accessible processos" ON public.prazos;
DROP POLICY IF EXISTS "Users can view prazos of accessible processos" ON public.prazos;

-- Create updated policies that also allow users to see prazos they are responsible for
CREATE POLICY "Users can view prazos of accessible processos or own" 
ON public.prazos 
FOR SELECT 
USING (
  can_access_processo(auth.uid(), processo_id) 
  OR responsavel_id = auth.uid()
);

CREATE POLICY "Users can manage prazos of accessible processos or own" 
ON public.prazos 
FOR ALL 
USING (
  can_access_processo(auth.uid(), processo_id) 
  OR responsavel_id = auth.uid()
);