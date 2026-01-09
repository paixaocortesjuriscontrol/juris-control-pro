
-- Add RLS policy for clients to view their own processes
CREATE POLICY "Clients can view their own processos"
ON public.processos
FOR SELECT
USING (
  -- Check if current user is linked to the client of this process via clientes_usuarios
  cliente_id IN (
    SELECT cu.cliente_id 
    FROM clientes_usuarios cu 
    WHERE cu.user_id = auth.uid() 
    AND cu.ativo = true
  )
);

-- Also need to allow clients to read movimentacoes for their processes
CREATE POLICY "Clients can view movimentacoes of their processos"
ON public.movimentacoes
FOR SELECT
USING (
  processo_id IN (
    SELECT p.id 
    FROM processos p
    JOIN clientes_usuarios cu ON cu.cliente_id = p.cliente_id
    WHERE cu.user_id = auth.uid() 
    AND cu.ativo = true
  )
);
