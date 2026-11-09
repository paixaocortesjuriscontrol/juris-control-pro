CREATE OR REPLACE FUNCTION public.reaper_execucoes_servidor_travadas()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0; r record; v_novo uuid; v_seg int; v_msg text;
BEGIN
  FOR r IN
    UPDATE public.execucoes_servidor
       SET status = 'falhou', finalizado_em = now(),
           erro = COALESCE(erro, '') || CASE WHEN COALESCE(erro,'') = '' THEN '' ELSE ' | ' END ||
             'Heartbeat parado (' || COALESCE(EXTRACT(EPOCH FROM (now() - heartbeat_at))::int, EXTRACT(EPOCH FROM (now() - iniciado_em))::int) ||
             's) — worker/VPS derrubado. Execute novamente (checkpoint preservado).',
           updated_at = now()
     WHERE status = 'executando'
       AND ((heartbeat_at IS NOT NULL AND heartbeat_at < now() - interval '10 minutes')
         OR (heartbeat_at IS NULL AND iniciado_em IS NOT NULL AND iniciado_em < now() - interval '10 minutes'))
    RETURNING id, tipo, payload, rodada_do_dia, slot_horario, agendado_para, heartbeat_at, iniciado_em
  LOOP
    v_count := v_count + 1;
    v_novo := NULL;
    v_seg := COALESCE(EXTRACT(EPOCH FROM (now() - r.heartbeat_at))::int, EXTRACT(EPOCH FROM (now() - r.iniciado_em))::int);
    IF NOT (COALESCE(r.payload,'{}'::jsonb) ? 'retomada_de') THEN
      BEGIN
        v_novo := public.enfileirar_execucao_servidor(r.tipo, now(),
          COALESCE(r.payload,'{}'::jsonb) || jsonb_build_object('manual', true, 'retomada_de', r.id),
          r.rodada_do_dia, r.slot_horario);
      EXCEPTION WHEN OTHERS THEN v_novo := NULL; END;
    END IF;
    v_msg := 'A busca agendada para ' || to_char(r.agendado_para AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') ||
      ' (Brasília) parou: servidor sem resposta por ' || v_seg || 's. ' ||
      CASE WHEN v_novo IS NOT NULL THEN 'Nova tentativa iniciada automaticamente, continuando de onde parou.'
           WHEN r.payload ? 'retomada_de' THEN 'Esta já era a nova tentativa automática; execute novamente manualmente.'
           ELSE 'Não foi possível iniciar nova tentativa; execute novamente manualmente.' END;
    INSERT INTO public.notificacoes (usuario_id, titulo, mensagem, tipo, link, dados)
    SELECT ur.user_id, 'DJEN Servidor: busca interrompida', v_msg, 'erro', '/monitoramento-djen-servidor',
           jsonb_build_object('execucao_id', r.id, 'nova_execucao_id', v_novo)
      FROM public.user_roles ur WHERE ur.role = 'admin';
  END LOOP;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notificar_conclusao_retomada_servidor()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('concluido','falhou')
     AND COALESCE(NEW.payload,'{}'::jsonb) ? 'retomada_de'
     AND COALESCE(NEW.erro,'') NOT LIKE '%Heartbeat parado%' THEN
    INSERT INTO public.notificacoes (usuario_id, titulo, mensagem, tipo, link, dados)
    SELECT ur.user_id,
      CASE WHEN NEW.status='concluido' THEN 'DJEN Servidor: nova tentativa concluída' ELSE 'DJEN Servidor: nova tentativa falhou' END,
      CASE WHEN NEW.status='concluido' THEN 'A nova tentativa automática terminou com sucesso às '
           ELSE 'A nova tentativa automática falhou às ' END ||
      to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') || ' (Brasília).' ||
      CASE WHEN NEW.status='falhou' THEN ' Execute novamente manualmente.' ELSE '' END,
      CASE WHEN NEW.status='concluido' THEN 'sucesso' ELSE 'erro' END,
      '/monitoramento-djen-servidor', jsonb_build_object('execucao_id', NEW.id)
    FROM public.user_roles ur WHERE ur.role='admin';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notificar_conclusao_retomada_servidor ON public.execucoes_servidor;
CREATE TRIGGER trg_notificar_conclusao_retomada_servidor AFTER UPDATE OF status ON public.execucoes_servidor
FOR EACH ROW EXECUTE FUNCTION public.notificar_conclusao_retomada_servidor();