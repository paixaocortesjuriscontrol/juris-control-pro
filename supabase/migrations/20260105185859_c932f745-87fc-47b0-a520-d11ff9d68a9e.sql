-- Função para busca de usuários (para menções) sem depender de RLS em profiles
CREATE OR REPLACE FUNCTION public.search_users_basic(_query text DEFAULT NULL, _limit int DEFAULT 5)
RETURNS TABLE(id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND (
      _query IS NULL
      OR btrim(_query) = ''
      OR p.nome ILIKE ('%' || _query || '%')
    )
  ORDER BY p.nome
  LIMIT GREATEST(_limit, 1);
$$;