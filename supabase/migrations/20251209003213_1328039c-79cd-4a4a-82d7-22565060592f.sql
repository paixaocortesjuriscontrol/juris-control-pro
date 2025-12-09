-- Phase 1: Drop the overly permissive profile visibility policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Phase 2: Create more restrictive profile visibility policy
-- Users can only see their own full profile, admins/coordenadores can see all
CREATE POLICY "Users can view own profile or admins can view all" 
ON public.profiles 
FOR SELECT 
USING (
  id = auth.uid()
  OR is_admin_or_coordenador(auth.uid())
);

-- Phase 3: Create a view for basic profile info needed for case assignment
-- This exposes only id and nome for all authenticated users
CREATE OR REPLACE VIEW public.profiles_basic AS
SELECT id, nome
FROM public.profiles;