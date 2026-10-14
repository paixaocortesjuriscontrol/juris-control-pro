CREATE OR REPLACE FUNCTION public.registrar_reativacao_processo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fechados text[] := array['encerrado','arquivado','arquivado_parcialmente','arquivado_definitivamente'];
BEGIN
  IF OLD.status::text = ANY(fechados) AND NOT (NEW.status::text = ANY(fechados)) THEN
    INSERT INTO auditoria_tarefas(usuario_id, acao, sucesso, origem, processo_id, tipo_item, coordenacao_id, dados_entrada, dados_saida, campos_alterados)
    VALUES (auth.uid(), 'processo_reativado', true, 'trigger', NEW.id, 'processo', NEW.coordenacao_id,
      jsonb_build_object('status_anterior', OLD.status, 'data_encerramento', OLD.data_encerramento,
        'data_hora_encerramento', OLD.data_hora_encerramento, 'data_arquivamento', OLD.data_arquivamento,
        'motivo_encerramento', OLD.motivo_encerramento),
      jsonb_build_object('status_novo', NEW.status, 'reativado_em', now()),
      jsonb_build_array('status','data_encerramento','data_hora_encerramento','data_arquivamento','motivo_encerramento'));
    NEW.data_encerramento := NULL;
    NEW.data_hora_encerramento := NULL;
    NEW.data_arquivamento := NULL;
    NEW.motivo_encerramento := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_registrar_reativacao_processo ON public.processos;
CREATE TRIGGER trg_registrar_reativacao_processo BEFORE UPDATE OF status ON public.processos
FOR EACH ROW EXECUTE FUNCTION public.registrar_reativacao_processo();