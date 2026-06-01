CREATE OR REPLACE FUNCTION public.atualizar_cor_processo_tag(_tag_id uuid, _cor text)
RETURNS TABLE(id uuid, cor text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador')) THEN
    RAISE EXCEPTION 'Sem permissão para alterar a cor desta TAG';
  END IF;

  IF _cor IS NULL OR _cor !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Cor inválida';
  END IF;

  RETURN QUERY
  UPDATE public.processo_tags_catalogo p
     SET cor = _cor,
         updated_at = now()
   WHERE p.id = _tag_id
     AND p.ativo = true
   RETURNING p.id, p.cor;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAG não encontrada';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.atualizar_cor_processo_tag(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.atualizar_cor_processo_tag(uuid, text) FROM anon;