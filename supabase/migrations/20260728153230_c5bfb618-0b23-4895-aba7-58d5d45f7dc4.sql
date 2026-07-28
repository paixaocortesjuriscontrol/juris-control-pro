-- 1) Admin / coordenador / assistente coordenador podem gerenciar qualquer tarefa
DROP POLICY IF EXISTS "Admins e coordenadores podem gerenciar todas as tarefas" ON public.tarefas;
CREATE POLICY "Admins e coordenadores podem gerenciar todas as tarefas"
ON public.tarefas
FOR ALL
TO authenticated
USING (public.is_admin_or_coordenador(auth.uid()))
WITH CHECK (public.is_admin_or_coordenador(auth.uid()));

-- 2) Coluna com os campos alterados (facilita relatório)
ALTER TABLE public.auditoria_tarefas
  ADD COLUMN IF NOT EXISTS campos_alterados jsonb;

-- 3) Função genérica de auditoria por trigger
CREATE OR REPLACE FUNCTION public.audit_item_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_antes jsonb;
  v_depois jsonb;
  v_diff jsonb := '[]'::jsonb;
  v_key text;
  v_tipo text;
  v_coord uuid;
  v_processo uuid;
  v_acao text;
  ignorar text[] := ARRAY['updated_at','atualizado_em','created_at'];
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

  IF TG_TABLE_NAME = 'tarefas' THEN
    v_tipo := CASE
      WHEN upper(coalesce((COALESCE(v_depois, v_antes) ->> 'tipo_tarefa'), '')) LIKE '%PRAZO%' THEN 'prazo'
      WHEN upper(coalesce((COALESCE(v_depois, v_antes) ->> 'tipo_tarefa'), '')) LIKE '%AUDI%' THEN 'audiencia'
      ELSE 'tarefa'
    END;
    v_processo := NULLIF(COALESCE(v_depois, v_antes) ->> 'processo_id', '')::uuid;
  ELSE
    v_tipo := lower(coalesce(NULLIF(COALESCE(v_depois, v_antes) ->> 'tipo', ''), 'evento'));
    IF v_tipo NOT IN ('evento','audiencia','parcelamento','tarefa','prazo') THEN
      v_tipo := 'evento';
    END IF;
    v_processo := NULL;
  END IF;

  v_coord := NULLIF(COALESCE(v_depois, v_antes) ->> 'coordenacao_id', '')::uuid;

  INSERT INTO public.auditoria_tarefas (
    usuario_id, acao, sucesso, dados_entrada, dados_saida, campos_alterados,
    origem, processo_id, tarefa_id, tipo_item, coordenacao_id
  ) VALUES (
    auth.uid(), v_acao, true, v_antes, v_depois,
    CASE WHEN TG_OP = 'UPDATE' THEN v_diff ELSE NULL END,
    'db_trigger:' || TG_TABLE_NAME,
    v_processo,
    (COALESCE(v_depois, v_antes) ->> 'id')::uuid,
    v_tipo,
    v_coord
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_tarefas ON public.tarefas;
CREATE TRIGGER trg_audit_tarefas
AFTER INSERT OR UPDATE OR DELETE ON public.tarefas
FOR EACH ROW EXECUTE FUNCTION public.audit_item_changes();

DROP TRIGGER IF EXISTS trg_audit_eventos_agenda ON public.eventos_agenda;
CREATE TRIGGER trg_audit_eventos_agenda
AFTER INSERT OR UPDATE OR DELETE ON public.eventos_agenda
FOR EACH ROW EXECUTE FUNCTION public.audit_item_changes();

-- 4) Coordenadores e assistentes coordenadores enxergam a auditoria da sua coordenação
DROP POLICY IF EXISTS "Coordenadores podem ver auditoria da coordenacao" ON public.auditoria_tarefas;
CREATE POLICY "Coordenadores podem ver auditoria da coordenacao"
ON public.auditoria_tarefas
FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'coordenador') OR public.has_role(auth.uid(), 'assistente_coordenador'))
  AND coordenacao_id IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM public.coordenacoes c WHERE c.id = auditoria_tarefas.coordenacao_id AND c.coordenador_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.membros_coordenacao m WHERE m.coordenacao_id = auditoria_tarefas.coordenacao_id AND m.usuario_id = auth.uid())
  )
);