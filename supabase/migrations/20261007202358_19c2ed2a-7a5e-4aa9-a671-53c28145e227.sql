CREATE OR REPLACE FUNCTION public.tipo_permissao_da_tarefa(_tipo text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN t LIKE '%AUDIENCIA%' THEN 'AUDIÊNCIA'
    WHEN t LIKE '%PARCELA%' THEN 'PARCELAMENTO'
    WHEN t LIKE '%PRAZO%' THEN 'PRAZO'
    WHEN t LIKE '%EVENTO%' OR t = 'OUTROS' THEN 'EVENTO'
    ELSE 'TAREFA' END
  FROM (SELECT upper(translate(coalesce(btrim(_tipo),''), 'áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ', 'aaaaeeiooouc AAAAEEIOOOUC')) AS t) s
$$;

-- Envolvido marcado pelo nome numa permissão de situação (ativa) do tipo do item
CREATE OR REPLACE FUNCTION public.envolvido_com_permissao_situacao(_user uuid, _tarefa uuid, _status text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tarefas t
    JOIN tarefa_envolvidos te ON te.tarefa_id = t.id AND te.usuario_id = _user
    JOIN permissoes_situacao_tipo_tarefa p
      ON p.coordenacao_id = t.coordenacao_id
     AND p.tipo_tarefa = public.tipo_permissao_da_tarefa(t.tipo_tarefa)
     AND p.ativa IS NOT FALSE
     AND p.situacao <> '__TODAS__'
     AND _user = ANY(coalesce(p.usuarios, '{}'::uuid[]))
    WHERE t.id = _tarefa
      AND (_status IS NULL
           OR p.situacao = _status
           OR (_status = 'cumprido' AND p.situacao = 'concluido')
           OR (_status = 'concluido' AND p.situacao = 'cumprido'))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.envolvido_com_permissao_situacao(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.envolvido_com_permissao_situacao(uuid,uuid,text) TO authenticated, service_role;

-- Versão com a situação escolhida (regra exata, usada pelo gatilho)
CREATE OR REPLACE FUNCTION public.pode_alterar_situacao_item(_user uuid, _tarefa uuid, _status text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.pode_alterar_situacao_item(_user, _tarefa) THEN RETURN true; END IF;
  RETURN public.envolvido_com_permissao_situacao(_user, _tarefa, _status);
END $$;
REVOKE EXECUTE ON FUNCTION public.pode_alterar_situacao_item(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_alterar_situacao_item(uuid,uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bloquear_alteracao_situacao_terceiros()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND auth.uid() IS NOT NULL THEN
    IF NOT public.pode_alterar_situacao_item(auth.uid(), OLD.id, NEW.status::text) THEN
      RAISE EXCEPTION 'Somente o responsável pode alterar a situação deste item.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.bloquear_alteracao_situacao_terceiros() FROM PUBLIC, anon, authenticated;