-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admins podem ver histórico de monitoramento" ON public.historico_monitoramento;

-- Create new policy allowing all authenticated users to view monitoring history
CREATE POLICY "Usuários autenticados podem ver histórico de monitoramento" 
ON public.historico_monitoramento 
FOR SELECT 
USING (auth.uid() IS NOT NULL);