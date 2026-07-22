
-- Cancela a execução alvo + TODAS pendentes/executando do mesmo tipo,
-- para que o worker VPS pare de processar a fila em cadeia.
CREATE OR REPLACE FUNCTION public.cancelar_execucao_servidor(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text;
BEGIN
  SELECT tipo INTO v_tipo FROM public.execucoes_servidor WHERE id = p_id;

  UPDATE public.execucoes_servidor
     SET status = 'cancelado',
         finalizado_em = COALESCE(finalizado_em, now()),
         erro = COALESCE(erro, 'Cancelado pelo usuário')
   WHERE id = p_id
     AND status IN ('pendente','executando','agendado');

  IF v_tipo IS NOT NULL THEN
    UPDATE public.execucoes_servidor
       SET status = 'cancelado',
           finalizado_em = COALESCE(finalizado_em, now()),
           erro = COALESCE(erro, 'Cancelado pelo usuário (fila do mesmo tipo)')
     WHERE tipo = v_tipo
       AND status IN ('pendente','agendado');
  END IF;
END;
$$;

-- Destravar agora usa 'cancelado' para que o worker VPS aborte
-- (o loop só encerra quando status = 'cancelado').
CREATE OR REPLACE FUNCTION public.destravar_execucao_servidor(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text;
BEGIN
  SELECT tipo INTO v_tipo FROM public.execucoes_servidor WHERE id = p_id;

  UPDATE public.execucoes_servidor
     SET status = 'cancelado',
         finalizado_em = now(),
         erro = COALESCE(NULLIF(erro,''), 'Destravado manualmente pelo usuário'),
         updated_at = now()
   WHERE id = p_id
     AND status IN ('executando','pendente','agendado');

  IF v_tipo IS NOT NULL THEN
    UPDATE public.execucoes_servidor
       SET status = 'cancelado',
           finalizado_em = COALESCE(finalizado_em, now()),
           erro = COALESCE(erro, 'Cancelado por destravamento manual (fila do mesmo tipo)'),
           updated_at = now()
     WHERE tipo = v_tipo
       AND status IN ('pendente','agendado');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_execucao_servidor(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.destravar_execucao_servidor(uuid) TO authenticated, service_role;
