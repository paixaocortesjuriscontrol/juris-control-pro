-- 1) Coordenadoras fixas como envolvidas em itens criados
CREATE OR REPLACE FUNCTION public.coordenadores_da_coordenacao(_coordenacao_id uuid)
RETURNS TABLE(usuario_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.coordenador_id FROM public.coordenacoes c
  WHERE c.id = _coordenacao_id AND c.coordenador_id IS NOT NULL
  UNION
  SELECT m.usuario_id FROM public.membros_coordenacao m
  WHERE m.coordenacao_id = _coordenacao_id
    AND lower(coalesce(m.cargo,'')) IN ('coordenador','coordenadora','assistente_coordenador')
$$;

CREATE OR REPLACE FUNCTION public.add_coordenadores_envolvidos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem text;
BEGIN
  IF NEW.coordenacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- não poluir importações em massa
  BEGIN
    v_origem := lower(coalesce((to_jsonb(NEW) ->> 'origem'), ''));
  EXCEPTION WHEN others THEN
    v_origem := '';
  END;
  IF v_origem IN ('astrea', 'importacao', 'projuris') THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'tarefas' THEN
    INSERT INTO public.tarefa_envolvidos (tarefa_id, usuario_id)
    SELECT NEW.id, c.usuario_id FROM public.coordenadores_da_coordenacao(NEW.coordenacao_id) c
    ON CONFLICT (tarefa_id, usuario_id) DO NOTHING;
  ELSIF TG_TABLE_NAME = 'eventos_agenda' THEN
    INSERT INTO public.evento_envolvidos (evento_id, usuario_id)
    SELECT NEW.id, c.usuario_id FROM public.coordenadores_da_coordenacao(NEW.coordenacao_id) c
    ON CONFLICT (evento_id, usuario_id) DO NOTHING;
  ELSIF TG_TABLE_NAME = 'audiencias_detectadas' THEN
    INSERT INTO public.audiencia_envolvidos (audiencia_id, usuario_id)
    SELECT NEW.id, c.usuario_id FROM public.coordenadores_da_coordenacao(NEW.coordenacao_id) c
    ON CONFLICT (audiencia_id, usuario_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coord_envolvidos_tarefas ON public.tarefas;
CREATE TRIGGER trg_coord_envolvidos_tarefas
AFTER INSERT ON public.tarefas
FOR EACH ROW EXECUTE FUNCTION public.add_coordenadores_envolvidos();

DROP TRIGGER IF EXISTS trg_coord_envolvidos_eventos ON public.eventos_agenda;
CREATE TRIGGER trg_coord_envolvidos_eventos
AFTER INSERT ON public.eventos_agenda
FOR EACH ROW EXECUTE FUNCTION public.add_coordenadores_envolvidos();

DROP TRIGGER IF EXISTS trg_coord_envolvidos_audiencias ON public.audiencias_detectadas;
CREATE TRIGGER trg_coord_envolvidos_audiencias
AFTER INSERT ON public.audiencias_detectadas
FOR EACH ROW EXECUTE FUNCTION public.add_coordenadores_envolvidos();

-- 2) Etiquetas de cliente: aplicação automática
CREATE OR REPLACE FUNCTION public.aplicar_etiquetas_cliente_processo(_processo_id uuid, _publicacao_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente uuid;
  v_coord uuid;
  v_count int := 0;
BEGIN
  SELECT cliente_id, coordenacao_id INTO v_cliente, v_coord
  FROM public.processos WHERE id = _processo_id;

  IF v_cliente IS NULL THEN
    RETURN 0;
  END IF;

  WITH etq AS (
    SELECT e.id, e.modulos
    FROM public.etiquetas e
    WHERE e.ativo AND e.cliente_id = v_cliente
      AND (v_coord IS NULL OR e.coordenacao_id = v_coord)
  ), ins_proc AS (
    INSERT INTO public.etiquetas_itens (etiqueta_id, entidade, entidade_id)
    SELECT etq.id, 'processo', _processo_id FROM etq
    WHERE 'processos' = ANY(etq.modulos)
    ON CONFLICT (etiqueta_id, entidade, entidade_id) DO NOTHING
    RETURNING 1
  ), ins_pub AS (
    INSERT INTO public.etiquetas_itens (etiqueta_id, entidade, entidade_id)
    SELECT etq.id, 'publicacao', _publicacao_id FROM etq
    WHERE _publicacao_id IS NOT NULL AND 'publicacoes' = ANY(etq.modulos)
    ON CONFLICT (etiqueta_id, entidade, entidade_id) DO NOTHING
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM ins_proc) + (SELECT count(*) FROM ins_pub) INTO v_count;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_etiqueta_cliente_publicacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.processo_id IS NOT NULL THEN
    PERFORM public.aplicar_etiquetas_cliente_processo(NEW.processo_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_etiqueta_cliente_pub_djen ON public.publicacoes_djen;
CREATE TRIGGER trg_etiqueta_cliente_pub_djen
AFTER INSERT ON public.publicacoes_djen
FOR EACH ROW EXECUTE FUNCTION public.trg_etiqueta_cliente_publicacao();

-- 3) Aplicação retroativa em lote (com prévia)
CREATE OR REPLACE FUNCTION public.aplicar_etiqueta_cliente_base(_etiqueta_id uuid, _dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etq record;
  v_total int := 0;
  v_aplicados int := 0;
BEGIN
  SELECT * INTO v_etq FROM public.etiquetas WHERE id = _etiqueta_id;
  IF v_etq IS NULL THEN
    RAISE EXCEPTION 'Etiqueta não encontrada';
  END IF;
  IF v_etq.cliente_id IS NULL THEN
    RAISE EXCEPTION 'Etiqueta sem cliente vinculado';
  END IF;
  IF NOT (public.has_role(auth.uid(), 'admin')
          OR EXISTS (SELECT 1 FROM public.membros_coordenacao m
                     WHERE m.coordenacao_id = v_etq.coordenacao_id AND m.usuario_id = auth.uid())) THEN
    RAISE EXCEPTION 'Sem permissão para esta coordenação';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.processos p
  WHERE p.cliente_id = v_etq.cliente_id
    AND p.coordenacao_id = v_etq.coordenacao_id;

  IF _dry_run THEN
    RETURN jsonb_build_object('total', v_total, 'aplicados', 0, 'dry_run', true);
  END IF;

  WITH ins AS (
    INSERT INTO public.etiquetas_itens (etiqueta_id, entidade, entidade_id, created_by)
    SELECT v_etq.id, 'processo', p.id, auth.uid()
    FROM public.processos p
    WHERE p.cliente_id = v_etq.cliente_id
      AND p.coordenacao_id = v_etq.coordenacao_id
    ON CONFLICT (etiqueta_id, entidade, entidade_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_aplicados FROM ins;

  RETURN jsonb_build_object('total', v_total, 'aplicados', v_aplicados, 'dry_run', false);
END;
$$;