CREATE OR REPLACE FUNCTION public.find_processo_id_by_numero(_numero text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.processos WHERE numero = _numero LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_processo_id_by_numero(text) TO authenticated;