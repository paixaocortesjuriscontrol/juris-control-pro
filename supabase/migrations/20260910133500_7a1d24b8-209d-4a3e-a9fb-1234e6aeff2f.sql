DROP POLICY IF EXISTS "clientes_delete_admin" ON public.clientes;

CREATE POLICY "clientes_delete_ativos"
ON public.clientes
FOR DELETE
TO authenticated
USING (is_user_active(auth.uid()));