CREATE OR REPLACE FUNCTION public.audit_item_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_antes jsonb;
  v_depois jsonb;
  v_diff jsonb := '[]'::jsonb;
  v_key text;
  v_tipo text;
  v_coord uuid;
  v_processo uuid;
  v_acao text;
  v_rec jsonb;
  ignorar text[] := ARRAY['updated_at','atualizado_em','created_at','tsv','texto_indexado'];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_acao := 'atualizar';
    v_antes := to_jsonb(OLD);
    v_depois := to_jsonb(NEW);
    FOR v_key IN SELECT jsonb_object_keys(v_depois) LOOP
      IF v_key = ANY(ignorar) THEN CONTINUE; END IF;
      IF (v_antes -> v_key) IS DISTINCT FROM (v_depois -> v_key) THEN
        v_diff := v_diff || jsonb_build_object(
          'campo', v_key,
          'de', v_antes -> v_key,
          'para', v_depois -> v_key
        );
      END IF;
    END LOOP;
    IF jsonb_array_length(v_diff) = 0 THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_acao := 'deletar';
    v_antes := to_jsonb(OLD);
    v_depois := NULL;
  ELSE
    v_acao := 'criar';
    v_antes := NULL;
    v_depois := to_jsonb(NEW);
  END IF;

  v_rec := COALESCE(v_depois, v_antes);

  IF TG_TABLE_NAME = 'tarefas' THEN
    v_tipo := CASE
      WHEN upper(coalesce((v_rec ->> 'tipo_tarefa'), '')) LIKE '%PRAZO%' THEN 'prazo'
      WHEN upper(coalesce((v_rec ->> 'tipo_tarefa'), '')) LIKE '%AUDI%' THEN 'audiencia'
      ELSE 'tarefa'
    END;
    v_processo := NULLIF(v_rec ->> 'processo_id', '')::uuid;
  ELSIF TG_TABLE_NAME = 'processos' THEN
    v_tipo := 'processo';
    v_processo := NULLIF(v_rec ->> 'id', '')::uuid;
  ELSIF TG_TABLE_NAME = 'audiencias_detectadas' THEN
    v_tipo := 'audiencia';
    v_processo := NULLIF(v_rec ->> 'processo_id', '')::uuid;
  ELSIF TG_TABLE_NAME = 'documentos' THEN
    v_tipo := 'documento';
    v_processo := NULLIF(v_rec ->> 'processo_id', '')::uuid;
  ELSE
    v_tipo := lower(coalesce(NULLIF(v_rec ->> 'tipo', ''), 'evento'));
    IF v_tipo NOT IN ('evento','audiencia','parcelamento','tarefa','prazo') THEN
      v_tipo := 'evento';
    END IF;
    v_processo := NULL;
  END IF;

  v_coord := NULLIF(v_rec ->> 'coordenacao_id', '')::uuid;

  -- Herda a coordenação do processo quando o item não possui a própria,
  -- para que o coordenador consiga visualizar o histórico (RLS).
  IF v_coord IS NULL AND v_processo IS NOT NULL THEN
    SELECT p.coordenacao_id INTO v_coord FROM public.processos p WHERE p.id = v_processo;
  END IF;

  INSERT INTO public.auditoria_tarefas (
    usuario_id, acao, sucesso, dados_entrada, dados_saida, campos_alterados,
    origem, processo_id, tarefa_id, tipo_item, coordenacao_id
  ) VALUES (
    auth.uid(), v_acao, true, v_antes, v_depois,
    CASE WHEN TG_OP = 'UPDATE' THEN v_diff ELSE NULL END,
    'db_trigger:' || TG_TABLE_NAME,
    v_processo,
    (v_rec ->> 'id')::uuid,
    v_tipo,
    v_coord
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_processos ON public.processos;
CREATE TRIGGER trg_audit_processos
AFTER INSERT OR UPDATE OR DELETE ON public.processos
FOR EACH ROW EXECUTE FUNCTION public.audit_item_changes();

DROP TRIGGER IF EXISTS trg_audit_audiencias_detectadas ON public.audiencias_detectadas;
CREATE TRIGGER trg_audit_audiencias_detectadas
AFTER INSERT OR UPDATE OR DELETE ON public.audiencias_detectadas
FOR EACH ROW EXECUTE FUNCTION public.audit_item_changes();

DROP TRIGGER IF EXISTS trg_audit_documentos ON public.documentos;
CREATE TRIGGER trg_audit_documentos
AFTER INSERT OR UPDATE OR DELETE ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.audit_item_changes();