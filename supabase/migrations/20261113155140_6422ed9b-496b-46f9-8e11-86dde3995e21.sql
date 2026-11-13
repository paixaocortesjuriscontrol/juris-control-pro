CREATE TABLE public.clientes_coordenacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  coordenacao_id uuid NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  UNIQUE (cliente_id, coordenacao_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes_coordenacoes TO authenticated;
GRANT ALL ON public.clientes_coordenacoes TO service_role;
ALTER TABLE public.clientes_coordenacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY cc_select ON public.clientes_coordenacoes FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));
CREATE POLICY cc_write ON public.clientes_coordenacoes FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public._pode_gerir_coordenacao(coordenacao_id))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public._pode_gerir_coordenacao(coordenacao_id));

CREATE TABLE public.permissoes_agendamento_coordenacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenacao_id uuid NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  cargo text,
  user_id uuid,
  tipo_item text NOT NULL CHECK (tipo_item IN ('tarefa','prazo','audiencia','evento')),
  permitido boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((cargo IS NULL) <> (user_id IS NULL))
);
CREATE UNIQUE INDEX pac_cargo_uk ON public.permissoes_agendamento_coordenacao(coordenacao_id, cargo, tipo_item) WHERE cargo IS NOT NULL;
CREATE UNIQUE INDEX pac_user_uk ON public.permissoes_agendamento_coordenacao(coordenacao_id, user_id, tipo_item) WHERE user_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_agendamento_coordenacao TO authenticated;
GRANT ALL ON public.permissoes_agendamento_coordenacao TO service_role;
ALTER TABLE public.permissoes_agendamento_coordenacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY pac_select ON public.permissoes_agendamento_coordenacao FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));
CREATE POLICY pac_write ON public.permissoes_agendamento_coordenacao FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public._pode_gerir_coordenacao(coordenacao_id))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public._pode_gerir_coordenacao(coordenacao_id));

CREATE OR REPLACE FUNCTION public.pode_configurar_agendamento(_user uuid, _coord uuid, _tipo text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v boolean;
BEGIN
  IF _user IS NULL OR _coord IS NULL OR public.has_role(_user,'admin') THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM coordenacoes WHERE id=_coord AND coordenador_id=_user) THEN RETURN true; END IF;
  SELECT permitido INTO v FROM permissoes_agendamento_coordenacao WHERE coordenacao_id=_coord AND user_id=_user AND tipo_item=_tipo;
  IF v IS NOT NULL THEN RETURN v; END IF;
  SELECT bool_or(COALESCE(p.permitido,true)) INTO v
    FROM membros_coordenacao m
    LEFT JOIN permissoes_agendamento_coordenacao p ON p.coordenacao_id=_coord AND p.cargo=m.cargo AND p.tipo_item=_tipo
   WHERE m.coordenacao_id=_coord AND m.usuario_id=_user;
  RETURN COALESCE(v,true);
END $$;
REVOKE EXECUTE ON FUNCTION public.pode_configurar_agendamento(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_configurar_agendamento(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.bloquear_configuracao_agendamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tipo text; _t text; _novo jsonb; _velho jsonb; k text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='audiencias_detectadas' THEN _tipo:='audiencia';
  ELSIF TG_TABLE_NAME='eventos_agenda' THEN _tipo:='evento';
  ELSE
    _t := upper(coalesce(NEW.tipo_tarefa,''));
    IF _t LIKE 'AUDI%' THEN _tipo:='audiencia';
    ELSIF _t='EVENTO' THEN _tipo:='evento';
    ELSIF _t LIKE 'PRAZO%' OR (to_jsonb(NEW)->>'data_fatal') IS NOT NULL THEN _tipo:='prazo';
    ELSE _tipo:='tarefa'; END IF;
  END IF;
  IF public.pode_configurar_agendamento(auth.uid(), NEW.coordenacao_id, _tipo) THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    RAISE EXCEPTION 'Sua coordenação não permite que você crie este tipo de agendamento.' USING ERRCODE='42501';
  END IF;
  _novo := to_jsonb(NEW); _velho := to_jsonb(OLD);
  FOR k IN SELECT key FROM jsonb_each(_novo) LOOP
    IF _novo->k IS DISTINCT FROM _velho->k
       AND k NOT IN ('status','updated_at','updated_by','motivo_cancelamento','observacao_status')
       AND k NOT LIKE '%\_em' AND k NOT LIKE '%\_por' AND k NOT LIKE '%conclu%' AND k NOT LIKE '%cumpri%' AND k NOT LIKE 'status\_%' THEN
      RAISE EXCEPTION 'Sua coordenação só permite mudar a situação deste agendamento.' USING ERRCODE='42501';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_bloquear_config_agendamento BEFORE INSERT OR UPDATE ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.bloquear_configuracao_agendamento();
CREATE TRIGGER trg_bloquear_config_agendamento BEFORE INSERT OR UPDATE ON public.audiencias_detectadas FOR EACH ROW EXECUTE FUNCTION public.bloquear_configuracao_agendamento();
CREATE TRIGGER trg_bloquear_config_agendamento BEFORE INSERT OR UPDATE ON public.eventos_agenda FOR EACH ROW EXECUTE FUNCTION public.bloquear_configuracao_agendamento();