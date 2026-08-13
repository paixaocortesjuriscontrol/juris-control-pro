DROP POLICY IF EXISTS clientes_update_admin ON public.clientes;

CREATE POLICY clientes_update_admin
ON public.clientes
FOR UPDATE
TO authenticated
USING (is_user_active(auth.uid()))
WITH CHECK (is_user_active(auth.uid()));

DROP POLICY IF EXISTS clientes_insert_admin ON public.clientes;

CREATE POLICY clientes_insert_admin
ON public.clientes
FOR INSERT
TO authenticated
WITH CHECK (is_user_active(auth.uid()));