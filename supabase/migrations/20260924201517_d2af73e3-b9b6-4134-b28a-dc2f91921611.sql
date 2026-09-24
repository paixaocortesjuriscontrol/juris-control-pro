CREATE OR REPLACE FUNCTION public.pode_alterar_situacao_item(_user uuid, _tarefa uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t record; cfg record; cargo_n text;
BEGIN
  IF _user IS NULL THEN RETURN true; END IF;
  IF public.has_role(_user,'admin') THEN RETURN true; END IF;
  SELECT id, responsavel_id, coordenacao_id INTO t FROM tarefas WHERE id = _tarefa;
  IF NOT FOUND THEN RETURN true; END IF;
  IF t.responsavel_id IS NULL OR t.responsavel_id = _user THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM tarefa_responsaveis WHERE tarefa_id = _tarefa AND usuario_id = _user) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM coordenacoes WHERE id = t.coordenacao_id AND coordenador_id = _user) THEN RETURN true; END IF;

  SELECT public.normalizar_cargo_perfil(cargo) INTO cargo_n FROM membros_coordenacao
   WHERE usuario_id = _user AND coordenacao_id = t.coordenacao_id LIMIT 1;
  IF cargo_n IS NULL THEN
    SELECT role::text INTO cargo_n FROM user_roles WHERE user_id = _user ORDER BY (role='coordenador') DESC LIMIT 1;
  END IF;
  IF cargo_n = 'coordenador' THEN RETURN true; END IF;

  SELECT * INTO cfg FROM config_alteracao_itens_terceiros WHERE coordenacao_id = t.coordenacao_id;
  IF FOUND THEN
    IF _user = ANY(cfg.usuarios) THEN RETURN true; END IF;
    IF cargo_n IS NOT NULL AND cargo_n = ANY(cfg.perfis) THEN RETURN true; END IF;
  END IF;
  RETURN false;
END $$;