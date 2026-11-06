CREATE OR REPLACE FUNCTION public.enfileirar_aviso_item(_tipo text, _entidade text, _id uuid, _ator uuid, _contexto jsonb DEFAULT '{}'::jsonb, _extra uuid[] DEFAULT '{}'::uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _coord uuid;
  _titulo text;
  _ids uuid[];
  _evento uuid;
  _origem text;
  _tarefa_criada_em timestamptz;
BEGIN
  IF _ator IS NULL THEN RETURN; END IF;
  IF coalesce(current_setting('app.sem_notificacao', true), '') = '1' THEN RETURN; END IF;

  IF _entidade = 'tarefa' THEN
    SELECT titulo, coordenacao_id, origem, created_at
      INTO _titulo, _coord, _origem, _tarefa_criada_em
      FROM public.tarefas WHERE id = _id;

    -- A tela de Migração Projuris abre um lote em_andamento antes de gravar.
    -- O bloqueio no banco vale inclusive para páginas já abertas, sem exigir
    -- recarregar arquivos ou refazer a análise do ZIP.
    IF _origem = 'projuris' THEN
      IF _tipo = 'participante_incluido'
         AND _tarefa_criada_em >= now() - interval '10 minutes'
         AND EXISTS (
           SELECT 1 FROM public.migracoes_projuris m
           WHERE m.coordenacao_id = _coord
             AND m.criado_por = _ator
             AND m.status = 'em_andamento'
             AND m.created_at >= now() - interval '24 hours'
             AND (
               lower(coalesce(m.mapeamento->>'modulo', '')) = 'tarefas'
               OR lower(coalesce(m.mapeamento->>'tabela', '')) = 'tarefas'
             )
         ) THEN
        RETURN;
      END IF;

      IF _tipo IN ('comentario', 'mencao', 'cobranca')
         AND EXISTS (
           SELECT 1 FROM public.migracoes_projuris m
           WHERE m.coordenacao_id = _coord
             AND m.criado_por = _ator
             AND m.status = 'em_andamento'
             AND m.created_at >= now() - interval '24 hours'
             AND lower(coalesce(m.mapeamento->>'modulo', '')) = 'comentarios'
         ) THEN
        RETURN;
      END IF;
    END IF;
  ELSIF _entidade = 'evento' THEN
    SELECT titulo, coordenacao_id INTO _titulo, _coord FROM public.eventos_agenda WHERE id = _id;
  ELSIF _entidade = 'audiencia' THEN
    SELECT coalesce(titulo, tipo_audiencia, 'Audiência'), coordenacao_id INTO _titulo, _coord FROM public.audiencias_detectadas WHERE id = _id;
  ELSIF _entidade = 'parcela' THEN
    SELECT pe.evento_id, 'Parcela ' || pe.numero, e.coordenacao_id
      INTO _evento, _titulo, _coord
      FROM public.parcelas_evento pe
      JOIN public.eventos_agenda e ON e.id = pe.evento_id
     WHERE pe.id = _id;
  END IF;

  IF _titulo IS NULL THEN RETURN; END IF;
  _ids := public.resolver_destinatarios_comentario(CASE WHEN _entidade = 'parcela' THEN 'evento' ELSE _entidade END, coalesce(_evento, _id));
  IF _entidade = 'evento' OR _entidade = 'parcela' THEN
    _ids := _ids || ARRAY(SELECT usuario_id FROM public.participantes_evento WHERE evento_id = coalesce(_evento, _id));
  END IF;
  IF _entidade = 'audiencia' THEN
    _ids := _ids || ARRAY(SELECT advogado_id FROM public.audiencias_advogados WHERE audiencia_id = _id);
  END IF;
  _ids := ARRAY(
    SELECT DISTINCT u FROM unnest(coalesce(_ids, '{}'::uuid[]) || coalesce(_extra, '{}'::uuid[]) || ARRAY[_ator]) u
    WHERE u IS NOT NULL
  );
  IF _tipo = 'participante_incluido' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(_id::text || coalesce(_contexto->>'usuario_id', ''), 0));
    IF EXISTS(
      SELECT 1 FROM public.notificacoes_fila
      WHERE entidade_id = _id AND tipo_evento = _tipo
        AND contexto->>'usuario_id' = _contexto->>'usuario_id'
        AND created_at >= clock_timestamp() - interval '1 minute'
    ) THEN RETURN; END IF;
  END IF;
  INSERT INTO public.notificacoes_fila(tipo_evento, entidade, entidade_id, coordenacao_id, titulo, responsaveis, contexto)
  VALUES(_tipo, _entidade, _id, _coord, _titulo, _ids, coalesce(_contexto, '{}'::jsonb) || jsonb_build_object('alterado_por', _ator, 'alterado_em', now()));
END
$function$;

CREATE OR REPLACE FUNCTION public.corrigir_titulos_tarefas_projuris(_coordenacao_id uuid, _itens jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  -- Manutenção em massa: não enviar avisos de alteração aos responsáveis.
  PERFORM set_config('app.sem_notificacao', '1', true);
  UPDATE public.tarefas t
     SET titulo = left(x.titulo, 500),
         descricao = COALESCE(NULLIF(x.descricao, ''), t.descricao),
         modelo_tarefa_id = COALESCE(t.modelo_tarefa_id, x.modelo_id)
    FROM jsonb_to_recordset(_itens) AS x(chave text, titulo text, descricao text, modelo_id uuid)
   WHERE t.coordenacao_id = _coordenacao_id AND t.origem = 'projuris'
     AND t.identificador_projuris = x.chave
     AND (t.titulo IS DISTINCT FROM left(x.titulo, 500) OR (x.modelo_id IS NOT NULL AND t.modelo_tarefa_id IS NULL));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$function$;