CREATE OR REPLACE FUNCTION public.pode_trocar_responsavel_item(_user uuid, _tarefa uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _user IS NULL
    OR NOT EXISTS (SELECT 1 FROM tarefas WHERE id = _tarefa)
    OR EXISTS (SELECT 1 FROM tarefas WHERE id = _tarefa AND (criado_por = _user OR created_at > now() - interval '10 minutes'))
    OR public.pode_alterar_situacao_item(_user, _tarefa)
$$;

CREATE OR REPLACE FUNCTION public.bloquear_troca_responsavel_terceiros()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_TABLE_NAME = 'tarefas' THEN
    IF NEW.responsavel_id IS NOT DISTINCT FROM OLD.responsavel_id THEN RETURN NEW; END IF;
    -- regra avaliada com o responsável anterior
    IF OLD.responsavel_id IS NOT NULL AND OLD.responsavel_id <> auth.uid()
       AND NOT public.has_role(auth.uid(),'admin')
       AND NOT EXISTS (SELECT 1 FROM tarefa_responsaveis WHERE tarefa_id = OLD.id AND usuario_id = auth.uid())
       AND NOT EXISTS (SELECT 1 FROM coordenacoes WHERE id = OLD.coordenacao_id AND coordenador_id = auth.uid())
       AND NOT public.pode_trocar_responsavel_item(auth.uid(), OLD.id) THEN
      RAISE EXCEPTION 'Somente o responsável pode trocar o responsável deste item.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  _id := COALESCE(NEW.tarefa_id, OLD.tarefa_id);
  IF NOT public.pode_trocar_responsavel_item(auth.uid(), _id) THEN
    RAISE EXCEPTION 'Somente o responsável pode trocar o responsável deste item.' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_bloquear_troca_responsavel ON public.tarefas;
CREATE TRIGGER trg_bloquear_troca_responsavel BEFORE UPDATE OF responsavel_id ON public.tarefas
FOR EACH ROW EXECUTE FUNCTION public.bloquear_troca_responsavel_terceiros();

DROP TRIGGER IF EXISTS trg_bloquear_troca_corresponsavel ON public.tarefa_responsaveis;
CREATE TRIGGER trg_bloquear_troca_corresponsavel BEFORE INSERT OR DELETE ON public.tarefa_responsaveis
FOR EACH ROW EXECUTE FUNCTION public.bloquear_troca_responsavel_terceiros();

REVOKE EXECUTE ON FUNCTION public.pode_trocar_responsavel_item(uuid,uuid) FROM PUBLIC, anon;