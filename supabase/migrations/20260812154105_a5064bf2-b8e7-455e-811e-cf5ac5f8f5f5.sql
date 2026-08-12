CREATE OR REPLACE FUNCTION public.sync_row_coordenacao_from_processo_or_criador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proc_coord uuid;
  v_user_coord uuid;
  v_count int;
  v_is_member boolean;
BEGIN
  -- 1) Coordenação informada explicitamente pelo formulário tem prioridade
  IF NEW.coordenacao_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      RETURN NEW;
    END IF;
    IF NEW.coordenacao_id IS DISTINCT FROM OLD.coordenacao_id THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Coordenação do processo (se houver processo vinculado)
  IF NEW.processo_id IS NOT NULL THEN
    SELECT p.coordenacao_id INTO v_proc_coord
      FROM public.processos p WHERE p.id = NEW.processo_id;
  END IF;

  -- Coordenações do criador
  IF NEW.criado_por IS NOT NULL THEN
    SELECT count(*) INTO v_count
      FROM public.membros_coordenacao m WHERE m.usuario_id = NEW.criado_por;
    IF v_count = 1 THEN
      SELECT m.coordenacao_id INTO v_user_coord
        FROM public.membros_coordenacao m WHERE m.usuario_id = NEW.criado_por LIMIT 1;
    END IF;

    IF v_proc_coord IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.membros_coordenacao m
         WHERE m.usuario_id = NEW.criado_por AND m.coordenacao_id = v_proc_coord
      ) INTO v_is_member;
    END IF;
  END IF;

  -- 2) Processo compartilhado: se o criador não é membro da coordenação do processo,
  --    o item nasce na coordenação do próprio criador
  IF v_proc_coord IS NOT NULL AND COALESCE(v_is_member, true) THEN
    NEW.coordenacao_id := v_proc_coord;
    RETURN NEW;
  END IF;

  IF v_user_coord IS NOT NULL THEN
    NEW.coordenacao_id := v_user_coord;
    RETURN NEW;
  END IF;

  IF NEW.coordenacao_id IS NULL AND v_proc_coord IS NOT NULL THEN
    NEW.coordenacao_id := v_proc_coord;
  END IF;

  RETURN NEW;
END;
$$;