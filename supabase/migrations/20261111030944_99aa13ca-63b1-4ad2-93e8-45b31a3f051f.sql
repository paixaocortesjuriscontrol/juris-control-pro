CREATE OR REPLACE FUNCTION public.audit_participante_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_rec jsonb := to_jsonb(COALESCE(NEW, OLD));
  v_item uuid; v_pessoa uuid; v_tipo text; v_papel text;
  v_proc uuid; v_coord uuid; v_tipo_tarefa text;
  v_acao text; v_origem text; v_par uuid;
BEGIN
  v_pessoa := COALESCE(NULLIF(v_rec->>'usuario_id','')::uuid, NULLIF(v_rec->>'advogado_id','')::uuid);
  IF TG_TABLE_NAME IN ('tarefa_responsaveis','tarefa_envolvidos') THEN
    v_item := (v_rec->>'tarefa_id')::uuid;
    v_papel := CASE WHEN TG_TABLE_NAME='tarefa_responsaveis' THEN 'responsavel' ELSE 'envolvido' END;
    SELECT processo_id, coordenacao_id, tipo_tarefa INTO v_proc, v_coord, v_tipo_tarefa FROM tarefas WHERE id=v_item;
    v_tipo := CASE WHEN upper(coalesce(v_tipo_tarefa,'')) LIKE '%PRAZO%' THEN 'prazo' ELSE 'tarefa' END;
  ELSIF TG_TABLE_NAME IN ('evento_responsaveis','evento_envolvidos') THEN
    v_item := (v_rec->>'evento_id')::uuid; v_tipo := 'evento';
    v_papel := CASE WHEN TG_TABLE_NAME='evento_responsaveis' THEN 'responsavel' ELSE 'envolvido' END;
    SELECT coordenacao_id INTO v_coord FROM eventos_agenda WHERE id=v_item;
  ELSE
    v_item := (v_rec->>'audiencia_id')::uuid; v_tipo := 'audiencia';
    v_papel := CASE WHEN TG_TABLE_NAME='audiencias_advogados' THEN 'advogado' ELSE 'envolvido' END;
    SELECT processo_id, coordenacao_id INTO v_proc, v_coord FROM audiencias_detectadas WHERE id=v_item;
  END IF;
  IF v_coord IS NULL AND v_proc IS NOT NULL THEN SELECT coordenacao_id INTO v_coord FROM processos WHERE id=v_proc; END IF;

  v_origem := CASE WHEN auth.uid() IS NULL THEN 'sistema' WHEN pg_trigger_depth() > 1 THEN 'automatico' ELSE 'manual' END;

  IF TG_OP = 'DELETE' THEN
    v_acao := 'participante_removido';
  ELSE
    v_acao := 'participante_incluido';
    -- Salvamento que apaga e grava de novo a mesma pessoa: registra como "mantido".
    SELECT id INTO v_par FROM auditoria_tarefas
     WHERE tarefa_id=v_item AND acao='participante_removido'
       AND dados_entrada->>'usuario_id' = v_pessoa::text AND dados_entrada->>'papel' = v_papel
       AND created_at > now() - interval '30 seconds'
     ORDER BY created_at DESC LIMIT 1;
    IF v_par IS NOT NULL THEN
      v_acao := 'participante_mantido';
      DELETE FROM auditoria_tarefas WHERE id=v_par;
    END IF;
  END IF;

  INSERT INTO auditoria_tarefas (usuario_id, acao, sucesso, dados_entrada, origem, processo_id, tarefa_id, tipo_item, coordenacao_id)
  VALUES (auth.uid(), v_acao, true,
    jsonb_build_object('papel', v_papel, 'usuario_id', v_pessoa, 'origem', v_origem),
    'db_trigger:' || TG_TABLE_NAME, v_proc, v_item, v_tipo, v_coord);
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['tarefa_responsaveis','tarefa_envolvidos','evento_responsaveis','evento_envolvidos','audiencia_envolvidos','audiencias_advogados'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_participante ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_audit_participante AFTER INSERT OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_participante_item()', t);
  END LOOP;
END $$;