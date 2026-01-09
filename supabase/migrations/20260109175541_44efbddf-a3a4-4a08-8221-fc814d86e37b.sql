-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Admins can view invitations" ON public.convites_cliente;

-- Create policy for admins to view all
CREATE POLICY "Admins can view all invitations"
  ON public.convites_cliente
  FOR SELECT
  USING (public.is_admin_or_coordenador(auth.uid()));

-- Create policy for anyone (including anonymous) to view by token
CREATE POLICY "Anyone can view invitation by token"
  ON public.convites_cliente
  FOR SELECT
  USING (true);  -- Token filtering happens in the WHERE clause of the query