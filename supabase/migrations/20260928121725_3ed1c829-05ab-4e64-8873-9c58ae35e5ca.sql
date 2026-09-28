CREATE INDEX IF NOT EXISTS idx_historico_login_user_data ON public.historico_login(user_id, logged_in_at);
CREATE INDEX IF NOT EXISTS idx_auditoria_tarefas_usuario_data ON public.auditoria_tarefas(usuario_id, created_at);
CREATE INDEX IF NOT EXISTS idx_auditoria_dist_tst_usuario_data ON public.auditoria_distribuicao_tst(usuario_id, created_at);

CREATE OR REPLACE FUNCTION public.get_usabilidade_sistema(_inicio date, _fim date, _coordenacao_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public SET statement_timeout='60s' AS $$
DECLARE ini timestamptz := (_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo');
        fim timestamptz := ((_fim+1)::timestamp AT TIME ZONE 'America/Sao_Paulo');
        adm boolean := has_role(auth.uid(),'admin');
        res jsonb;
BEGIN
  IF NOT (adm OR has_role(auth.uid(),'coordenador') OR has_role(auth.uid(),'assistente_coordenador')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  WITH us AS (
    SELECT p.id, p.nome, p.email, coalesce(p.ativo,true) ativo
    FROM profiles p
    WHERE (_coordenacao_id IS NULL OR EXISTS(SELECT 1 FROM membros_coordenacao m WHERE m.usuario_id=p.id AND m.coordenacao_id=_coordenacao_id)
           OR EXISTS(SELECT 1 FROM coordenacoes c WHERE c.id=_coordenacao_id AND c.coordenador_id=p.id))
      AND (adm OR EXISTS(SELECT 1 FROM membros_coordenacao m WHERE m.usuario_id=p.id AND m.coordenacao_id IN
            (SELECT coordenacao_id FROM membros_coordenacao WHERE usuario_id=auth.uid() UNION SELECT id FROM coordenacoes WHERE coordenador_id=auth.uid())))
      AND NOT has_role(p.id,'cliente')
  ),
  lg AS (SELECT user_id u, count(*) n, count(DISTINCT (logged_in_at AT TIME ZONE 'America/Sao_Paulo')::date) d FROM historico_login WHERE logged_in_at>=ini AND logged_in_at<fim AND user_id IN (SELECT id FROM us) GROUP BY 1),
  ult AS (SELECT user_id u, max(logged_in_at) m FROM historico_login WHERE user_id IN (SELECT id FROM us) GROUP BY 1),
  at AS (SELECT usuario_id u, count(*) n, count(*) FILTER (WHERE acao='criar') cr, count(*) FILTER (WHERE acao='atualizar') up, count(*) FILTER (WHERE acao='deletar') del, count(*) FILTER (WHERE sucesso=false OR acao LIKE 'erro%') er,
         count(DISTINCT (created_at AT TIME ZONE 'America/Sao_Paulo')::date) d, max(created_at) m
         FROM auditoria_tarefas WHERE created_at>=ini AND created_at<fim AND usuario_id IN (SELECT id FROM us) GROUP BY 1),
  tst AS (SELECT usuario_id u, count(*) n, max(created_at) m FROM auditoria_distribuicao_tst WHERE created_at>=ini AND created_at<fim AND usuario_id IN (SELECT id FROM us) GROUP BY 1),
  jd AS (SELECT created_by u, count(*) n FROM judit_logs WHERE created_at>=ini AND created_at<fim AND created_by IN (SELECT id FROM us) GROUP BY 1),
  ia AS (SELECT user_id u, count(*) n FROM ai_usage_logs WHERE created_at>=ini AND created_at<fim AND user_id IN (SELECT id FROM us) GROUP BY 1),
  linhas AS (
    SELECT us.id, us.nome, us.email, us.ativo,
      coalesce(lg.n,0) logins, coalesce(lg.d,0) dias_login, coalesce(at.d,0) dias_acao,
      greatest(ult.m, at.m, tst.m) ultimo_acesso,
      coalesce(at.n,0) acoes_itens, coalesce(at.cr,0) criados, coalesce(at.up,0) atualizados, coalesce(at.del,0) excluidos, coalesce(at.er,0) erros,
      coalesce(tst.n,0) acoes_tst, coalesce(jd.n,0) consultas_judit, coalesce(ia.n,0) usos_ia
    FROM us LEFT JOIN lg ON lg.u=us.id LEFT JOIN ult ON ult.u=us.id LEFT JOIN at ON at.u=us.id
      LEFT JOIN tst ON tst.u=us.id LEFT JOIN jd ON jd.u=us.id LEFT JOIN ia ON ia.u=us.id
  ),
  dia AS (
    SELECT d::date dia,
      (SELECT count(DISTINCT user_id) FROM historico_login WHERE user_id IN (SELECT id FROM us) AND (logged_in_at AT TIME ZONE 'America/Sao_Paulo')::date=d::date) usuarios,
      (SELECT count(*) FROM historico_login WHERE user_id IN (SELECT id FROM us) AND (logged_in_at AT TIME ZONE 'America/Sao_Paulo')::date=d::date) logins,
      (SELECT count(*) FROM auditoria_tarefas WHERE usuario_id IN (SELECT id FROM us) AND created_at>=(d::timestamp AT TIME ZONE 'America/Sao_Paulo') AND created_at<((d::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')) acoes
    FROM generate_series(_inicio,_fim,interval '1 day') d
  ),
  hora AS (
    SELECT extract(hour FROM logged_in_at AT TIME ZONE 'America/Sao_Paulo')::int h, count(*) n
    FROM historico_login WHERE logged_in_at>=ini AND logged_in_at<fim AND user_id IN (SELECT id FROM us) GROUP BY 1
  ),
  tipo AS (
    SELECT coalesce(tipo_item,'outros') t, count(*) n FROM auditoria_tarefas
    WHERE created_at>=ini AND created_at<fim AND usuario_id IN (SELECT id FROM us) GROUP BY 1
  )
  SELECT jsonb_build_object(
    'usuarios', coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.logins+l.acoes_itens+l.acoes_tst DESC, l.nome) FROM linhas l),'[]'),
    'por_dia', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.dia) FROM dia x),'[]'),
    'por_hora', coalesce((SELECT jsonb_agg(jsonb_build_object('hora',h,'logins',n) ORDER BY h) FROM hora),'[]'),
    'por_tipo', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo',t,'qtd',n) ORDER BY n DESC) FROM tipo),'[]')
  ) INTO res;
  RETURN res;
END $$;
GRANT EXECUTE ON FUNCTION public.get_usabilidade_sistema(date,date,uuid) TO authenticated;