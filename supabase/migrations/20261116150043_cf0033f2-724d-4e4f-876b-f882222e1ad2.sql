CREATE OR REPLACE FUNCTION public.pode_configurar_agendamento(_user uuid, _coord uuid, _tipo text)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v boolean;
BEGIN
  IF _user IS NULL OR _coord IS NULL OR public.has_role(_user,'admin') THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM coordenacoes WHERE id=_coord AND coordenador_id=_user) THEN RETURN true; END IF;
  SELECT permitido INTO v FROM permissoes_agendamento_coordenacao WHERE coordenacao_id=_coord AND user_id=_user AND tipo_item=_tipo;
  IF v IS NOT NULL THEN RETURN v; END IF;
  SELECT bool_or(COALESCE(p.permitido,true)) INTO v
    FROM membros_coordenacao m
    LEFT JOIN permissoes_agendamento_coordenacao p ON p.coordenacao_id=_coord AND p.user_id IS NULL
      AND public.normalizar_cargo_perfil(p.cargo)=public.normalizar_cargo_perfil(m.cargo) AND p.tipo_item=_tipo
   WHERE m.coordenacao_id=_coord AND m.usuario_id=_user;
  RETURN COALESCE(v,true);
END $function$;

UPDATE public.permissoes_agendamento_coordenacao SET permitido=true, updated_at=now()
WHERE coordenacao_id='968631d0-6659-46f1-b45d-899892cb0121' AND user_id IS NULL AND cargo ILIKE 'advogado%' AND permitido=false;