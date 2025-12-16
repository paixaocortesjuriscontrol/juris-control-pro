-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Usuários podem ver alertas de processos acessíveis" ON public.alertas_monitoramento;

-- Create new more permissive SELECT policy
CREATE POLICY "Usuários podem ver alertas de processos acessíveis" 
ON public.alertas_monitoramento 
FOR SELECT 
USING (
  -- Admins e coordenadores podem ver todos os alertas
  is_admin_or_coordenador(auth.uid())
  OR
  -- Outros usuários só veem alertas de processos que têm acesso
  can_access_processo(auth.uid(), processo_id)
);

-- Also update the UPDATE policy to be more permissive for admins
DROP POLICY IF EXISTS "Usuários podem atualizar alertas de processos acessíveis" ON public.alertas_monitoramento;

CREATE POLICY "Usuários podem atualizar alertas de processos acessíveis" 
ON public.alertas_monitoramento 
FOR UPDATE 
USING (
  is_admin_or_coordenador(auth.uid())
  OR
  can_access_processo(auth.uid(), processo_id)
);