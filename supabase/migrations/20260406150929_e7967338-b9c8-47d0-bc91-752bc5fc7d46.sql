DROP VIEW IF EXISTS public.profiles_basic;

CREATE VIEW public.profiles_basic 
WITH (security_invoker = false)
AS
SELECT id, nome
FROM public.profiles;

GRANT SELECT ON public.profiles_basic TO authenticated;