-- 1. Criar função security definer para buscar convite por token
CREATE OR REPLACE FUNCTION public.get_convite_by_token(p_token text)
RETURNS TABLE(id uuid, email text, status text, expira_em timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    cc.id,
    cc.email,
    cc.status,
    cc.expira_em
  FROM public.convites_cliente cc
  WHERE cc.token = p_token
  LIMIT 1;
$$;

-- 2. Remover a política pública que expõe todos os convites
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.convites_cliente;