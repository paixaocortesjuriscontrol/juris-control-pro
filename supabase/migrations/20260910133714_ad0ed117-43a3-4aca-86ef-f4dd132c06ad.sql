CREATE TABLE public.auditoria_exclusao_clientes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL,
  cliente_nome text NOT NULL,
  cliente_cpf_cnpj text,
  cliente_email text,
  cliente_telefone text,
  processos_desvinculados integer NOT NULL DEFAULT 0,
  pastas_desvinculadas integer NOT NULL DEFAULT 0,
  excluido_por uuid,
  excluido_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.auditoria_exclusao_clientes TO authenticated;
GRANT ALL ON public.auditoria_exclusao_clientes TO service_role;

ALTER TABLE public.auditoria_exclusao_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auditoria_exclusao_clientes_select_ativos"
ON public.auditoria_exclusao_clientes
FOR SELECT
TO authenticated
USING (is_user_active(auth.uid()));

CREATE INDEX idx_auditoria_exclusao_clientes_created_at
  ON public.auditoria_exclusao_clientes (created_at DESC);

CREATE OR REPLACE FUNCTION public.excluir_cliente_com_desvinculo(p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cliente public.clientes;
  v_proc integer := 0;
  v_pastas integer := 0;
  v_nome text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_user_active(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para excluir clientes';
  END IF;

  SELECT * INTO v_cliente FROM public.clientes WHERE id = p_cliente_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  UPDATE public.processos SET cliente_id = NULL WHERE cliente_id = p_cliente_id;
  GET DIAGNOSTICS v_proc = ROW_COUNT;

  UPDATE public.pastas SET cliente_id = NULL WHERE cliente_id = p_cliente_id;
  GET DIAGNOSTICS v_pastas = ROW_COUNT;

  SELECT nome INTO v_nome FROM public.profiles WHERE id = v_uid;

  DELETE FROM public.clientes WHERE id = p_cliente_id;

  INSERT INTO public.auditoria_exclusao_clientes (
    cliente_id, cliente_nome, cliente_cpf_cnpj, cliente_email, cliente_telefone,
    processos_desvinculados, pastas_desvinculadas, excluido_por, excluido_por_nome
  ) VALUES (
    v_cliente.id, v_cliente.nome, v_cliente.cpf_cnpj, v_cliente.email, v_cliente.telefone,
    v_proc, v_pastas, v_uid, v_nome
  );

  RETURN jsonb_build_object(
    'processos_desvinculados', v_proc,
    'pastas_desvinculadas', v_pastas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_cliente_com_desvinculo(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.excluir_cliente_com_desvinculo(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.excluir_cliente_com_desvinculo(uuid) TO authenticated;