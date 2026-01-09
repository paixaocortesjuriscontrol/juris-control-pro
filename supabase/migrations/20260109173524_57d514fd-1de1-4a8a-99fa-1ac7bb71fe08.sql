-- Create table to link auth users (clients) to clientes records
CREATE TABLE public.clientes_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cliente_id, user_id)
);

-- Create index for performance
CREATE INDEX idx_clientes_usuarios_cliente ON public.clientes_usuarios(cliente_id);
CREATE INDEX idx_clientes_usuarios_user ON public.clientes_usuarios(user_id);

-- Enable RLS
ALTER TABLE public.clientes_usuarios ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see their own linkages
CREATE POLICY "Users can view own client links"
  ON public.clientes_usuarios
  FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin_or_coordenador(auth.uid()));

-- RLS: Only admins can insert/update/delete links
CREATE POLICY "Admins can insert client links"
  ON public.clientes_usuarios
  FOR INSERT
  WITH CHECK (public.is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Admins can update client links"
  ON public.clientes_usuarios
  FOR UPDATE
  USING (public.is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Admins can delete client links"
  ON public.clientes_usuarios
  FOR DELETE
  USING (public.is_admin_or_coordenador(auth.uid()));

-- Create table for client invitations
CREATE TABLE public.convites_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'expirado', 'cancelado')),
  enviado_por UUID REFERENCES auth.users(id),
  aceito_em TIMESTAMPTZ,
  expira_em TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for token lookups
CREATE INDEX idx_convites_cliente_token ON public.convites_cliente(token);
CREATE INDEX idx_convites_cliente_email ON public.convites_cliente(email);

-- Enable RLS
ALTER TABLE public.convites_cliente ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can manage invitations
CREATE POLICY "Admins can insert invitations"
  ON public.convites_cliente
  FOR INSERT
  WITH CHECK (public.is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Admins can view invitations"
  ON public.convites_cliente
  FOR SELECT
  USING (public.is_admin_or_coordenador(auth.uid()) OR token IS NOT NULL);

CREATE POLICY "Admins can update invitations"
  ON public.convites_cliente
  FOR UPDATE
  USING (public.is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Admins can delete invitations"
  ON public.convites_cliente
  FOR DELETE
  USING (public.is_admin_or_coordenador(auth.uid()));

-- Create helper function to check if user is a client
CREATE OR REPLACE FUNCTION public.is_cliente(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role = 'cliente'
  )
$$;

-- Create helper function to get client IDs for a user
CREATE OR REPLACE FUNCTION public.get_cliente_ids_for_user(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(cliente_id), ARRAY[]::uuid[])
  FROM public.clientes_usuarios
  WHERE user_id = _user_id AND ativo = true
$$;

-- Trigger for updated_at
CREATE TRIGGER update_clientes_usuarios_updated_at
  BEFORE UPDATE ON public.clientes_usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();