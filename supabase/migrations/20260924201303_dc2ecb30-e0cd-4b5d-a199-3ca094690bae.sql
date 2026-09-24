CREATE TABLE public.config_alteracao_itens_terceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenacao_id uuid NOT NULL UNIQUE REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  perfis text[] NOT NULL DEFAULT '{}',
  usuarios uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_alteracao_itens_terceiros TO authenticated;
GRANT ALL ON public.config_alteracao_itens_terceiros TO service_role;
ALTER TABLE public.config_alteracao_itens_terceiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem config de alteracao" ON public.config_alteracao_itens_terceiros
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/coordenador gerenciam config de alteracao" ON public.config_alteracao_itens_terceiros
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.membros_coordenacao m WHERE m.coordenacao_id = config_alteracao_itens_terceiros.coordenacao_id AND m.usuario_id = auth.uid() AND lower(m.cargo) LIKE '%coordenador%' AND lower(m.cargo) NOT LIKE '%assistente%'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.membros_coordenacao m WHERE m.coordenacao_id = config_alteracao_itens_terceiros.coordenacao_id AND m.usuario_id = auth.uid() AND lower(m.cargo) LIKE '%coordenador%' AND lower(m.cargo) NOT LIKE '%assistente%'));

CREATE TRIGGER trg_config_alteracao_itens_terceiros_updated
  BEFORE UPDATE ON public.config_alteracao_itens_terceiros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.normalizar_cargo_perfil(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN b = '' THEN NULL
    WHEN b LIKE '%assistente%' AND b LIKE '%coordenador%' THEN 'assistente_coordenador'
    WHEN b LIKE '%coordenador%' THEN 'coordenador'
    WHEN b LIKE '%advogado%' AND b LIKE '%temp%' THEN 'advogado_temporario'
    WHEN b LIKE '%advogado%' THEN 'advogado'
    WHEN b LIKE '%estagiari%' THEN 'estagiario'
    WHEN b LIKE '%secretari%' THEN 'secretaria'
    WHEN b LIKE '%assistente%' THEN 'assistente'
    WHEN b LIKE '%admin%' THEN 'admin'
    ELSE replace(b,' ','_') END
  FROM (SELECT lower(translate(trim(coalesce(p,'')),'áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ','aaaaeeiooouc'||'aaaaeeiooouc')) b) s
$$;

CREATE OR REPLACE FUNCTION public.pode_alterar_situacao_item(_user uuid, _tarefa uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t record; cfg record; cargo_n text; perfil_global text;
BEGIN
  IF _user IS NULL THEN RETURN true; END IF;
  IF public.has_role(_user,'admin') THEN RETURN true; END IF;
  SELECT id, responsavel_id, coordenacao_id INTO t FROM tarefas WHERE id = _tarefa;
  IF NOT FOUND THEN RETURN true; END IF;
  IF t.responsavel_id IS NULL OR t.responsavel_id = _user THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM tarefa_responsaveis WHERE tarefa_id = _tarefa AND usuario_id = _user) THEN RETURN true; END IF;

  SELECT public.normalizar_cargo_perfil(cargo) INTO cargo_n FROM membros_coordenacao
   WHERE usuario_id = _user AND coordenacao_id = t.coordenacao_id LIMIT 1;
  IF cargo_n IS NULL THEN
    SELECT role::text INTO perfil_global FROM user_roles WHERE user_id = _user ORDER BY (role='coordenador') DESC LIMIT 1;
    cargo_n := perfil_global;
  END IF;
  IF cargo_n = 'coordenador' THEN RETURN true; END IF;

  SELECT * INTO cfg FROM config_alteracao_itens_terceiros WHERE coordenacao_id = t.coordenacao_id;
  IF FOUND THEN
    IF _user = ANY(cfg.usuarios) THEN RETURN true; END IF;
    IF cargo_n IS NOT NULL AND cargo_n = ANY(cfg.perfis) THEN RETURN true; END IF;
  END IF;
  RETURN false;
END $$;

REVOKE EXECUTE ON FUNCTION public.pode_alterar_situacao_item(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_alterar_situacao_item(uuid,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bloquear_alteracao_situacao_terceiros()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND auth.uid() IS NOT NULL THEN
    IF NOT public.pode_alterar_situacao_item(auth.uid(), OLD.id) THEN
      RAISE EXCEPTION 'Somente o responsável pode alterar a situação deste item.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.bloquear_alteracao_situacao_terceiros() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_bloquear_alteracao_situacao_terceiros
  BEFORE UPDATE OF status ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_alteracao_situacao_terceiros();