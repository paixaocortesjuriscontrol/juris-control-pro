CREATE OR REPLACE FUNCTION public.excluir_cliente_com_desvinculo(p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_cliente public.clientes;
  v_proc integer := 0;
  v_pastas integer := 0;
  v_etq integer := 0;
  v_nome text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_user_active(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para excluir clientes';
  END IF;

  SELECT * INTO v_cliente FROM public.clientes WHERE id = p_cliente_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  -- marcações da entidade cliente
  DELETE FROM public.etiquetas_itens
  WHERE entidade = 'cliente' AND entidade_id = p_cliente_id;

  -- etiquetas vinculadas ao cliente (nome do cliente) e suas marcações
  DELETE FROM public.etiquetas_itens
  WHERE etiqueta_id IN (SELECT id FROM public.etiquetas WHERE cliente_id = p_cliente_id);

  DELETE FROM public.etiquetas WHERE cliente_id = p_cliente_id;
  GET DIAGNOSTICS v_etq = ROW_COUNT;

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
    'pastas_desvinculadas', v_pastas,
    'etiquetas_excluidas', v_etq
  );
END;
$function$;