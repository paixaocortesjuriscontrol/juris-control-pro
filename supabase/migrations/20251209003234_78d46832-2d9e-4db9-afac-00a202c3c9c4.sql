-- Drop the SECURITY DEFINER view and recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.profiles_basic;

-- Create view with SECURITY INVOKER (default, but explicit for clarity)
-- This view runs with the permissions of the querying user
CREATE VIEW public.profiles_basic 
WITH (security_invoker = true)
AS
SELECT id, nome
FROM public.profiles;