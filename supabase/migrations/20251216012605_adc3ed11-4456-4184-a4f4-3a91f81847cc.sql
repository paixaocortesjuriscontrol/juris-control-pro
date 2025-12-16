-- Create login history table
CREATE TABLE public.historico_login (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  logged_in_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

-- Enable RLS
ALTER TABLE public.historico_login ENABLE ROW LEVEL SECURITY;

-- Only admins can view login history
CREATE POLICY "Admins podem ver histórico de login"
ON public.historico_login
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- System can insert login records
CREATE POLICY "Sistema pode inserir histórico de login"
ON public.historico_login
FOR INSERT
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_historico_login_user_id ON public.historico_login(user_id);
CREATE INDEX idx_historico_login_logged_in_at ON public.historico_login(logged_in_at DESC);