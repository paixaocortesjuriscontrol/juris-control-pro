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
    SELECT p.id, p.nome, p.email, coalesce(p.ativo,true) ativo FROM profiles p
    WHERE (_coordenacao_id IS NULL OR EXISTS(SELECT 1 FROM membros_coordenacao m WHERE m.usuario_id=p.id AND m.coordenacao_id=_coordenacao_id)
           OR EXISTS(SELECT 1 FROM coordenacoes c WHERE c.id=_coordenacao_id AND c.coordenador_id=p.id))
      AND (adm OR EXISTS(SELECT 1 FROM membros_coordenacao m WHERE m.usuario_id=p.id AND m.coordenacao_id IN
            (SELECT coordenacao_id FROM membros_coordenacao WHERE usuario_id=auth.uid() UNION SELECT id FROM coordenacoes WHERE coordenador_id=auth.uid())))
      AND NOT has_role(p.id,'cliente')
  ),
  atv AS (
    SELECT user_id u, logged_in_at t, 'login'::text k, id::text s FROM historico_login WHERE logged_in_at>=ini AND logged_in_at<fim AND user_id IN (SELECT id FROM us)
    UNION ALL SELECT rt.user_id::uuid, rt.created_at, 'sessao', rt.session_id::text FROM auth.refresh_tokens rt
      WHERE rt.created_at>=ini AND rt.created_at<fim AND rt.user_id::uuid IN (SELECT id FROM us)
    UNION ALL SELECT usuario_id, created_at, 'acao', NULL FROM auditoria_tarefas WHERE created_at>=ini AND created_at<fim AND usuario_id IN (SELECT id FROM us)
    UNION ALL SELECT usuario_id, created_at, 'acao', NULL FROM auditoria_distribuicao_tst WHERE created_at>=ini AND created_at<fim AND usuario_id IN (SELECT id FROM us)
  ),
  ag AS (SELECT u, count(DISTINCT (t AT TIME ZONE 'America/Sao_Paulo')::date) d,
      count(DISTINCT date_trunc('hour', t AT TIME ZONE 'America/Sao_Paulo')) h,
      count(DISTINCT s) FILTER (WHERE k IN ('login','sessao')) acessos, max(t) m FROM atv GROUP BY u),
  ult AS (SELECT user_id u, max(logged_in_at) m FROM historico_login WHERE user_id IN (SELECT id FROM us) GROUP BY 1),
  at AS (SELECT usuario_id u, count(*) n, count(*) FILTER (WHERE acao='criar') cr, count(*) FILTER (WHERE acao='atualizar') up, count(*) FILTER (WHERE acao='deletar') del, count(*) FILTER (WHERE sucesso=false OR acao LIKE 'erro%') er
         FROM auditoria_tarefas WHERE created_at>=ini AND created_at<fim AND usuario_id IN (SELECT id FROM us) GROUP BY 1),
  tst AS (SELECT usuario_id u, count(*) n FROM auditoria_distribuicao_tst WHERE created_at>=ini AND created_at<fim AND usuario_id IN (SELECT id FROM us) GROUP BY 1),
  jd AS (SELECT created_by u, count(*) n FROM judit_logs WHERE created_at>=ini AND created_at<fim AND created_by IN (SELECT id FROM us) GROUP BY 1),
  ia AS (SELECT user_id u, count(*) n FROM ai_usage_logs WHERE created_at>=ini AND created_at<fim AND user_id IN (SELECT id FROM us) GROUP BY 1),
  linhas AS (
    SELECT us.id, us.nome, us.email, us.ativo,
      coalesce(ag.acessos,0) logins, coalesce(ag.d,0) dias_login, coalesce(ag.d,0) dias_acao, coalesce(ag.h,0) horas_ativas,
      greatest(ag.m, ult.m) ultimo_acesso,
      coalesce(at.n,0) acoes_itens, coalesce(at.cr,0) criados, coalesce(at.up,0) atualizados, coalesce(at.del,0) excluidos, coalesce(at.er,0) erros,
      coalesce(tst.n,0) acoes_tst, coalesce(jd.n,0) consultas_judit, coalesce(ia.n,0) usos_ia
    FROM us LEFT JOIN ag ON ag.u=us.id LEFT JOIN ult ON ult.u=us.id LEFT JOIN at ON at.u=us.id
      LEFT JOIN tst ON tst.u=us.id LEFT JOIN jd ON jd.u=us.id LEFT JOIN ia ON ia.u=us.id
  ),
  dd AS (SELECT (t AT TIME ZONE 'America/Sao_Paulo')::date dia, count(DISTINCT u) usuarios,
      count(DISTINCT s) FILTER (WHERE k IN ('login','sessao')) logins, count(*) FILTER (WHERE k='acao') acoes FROM atv GROUP BY 1),
  dia AS (SELECT g::date dia, coalesce(dd.usuarios,0) usuarios, coalesce(dd.logins,0) logins, coalesce(dd.acoes,0) acoes
    FROM generate_series(_inicio,_fim,interval '1 day') g LEFT JOIN dd ON dd.dia=g::date),
  hora AS (SELECT extract(hour FROM t AT TIME ZONE 'America/Sao_Paulo')::int h, count(DISTINCT u::text||(t AT TIME ZONE 'America/Sao_Paulo')::date) n FROM atv GROUP BY 1),
  tipo AS (SELECT coalesce(tipo_item,'outros') t, count(*) n FROM auditoria_tarefas WHERE created_at>=ini AND created_at<fim AND usuario_id IN (SELECT id FROM us) GROUP BY 1)
  SELECT jsonb_build_object(
    'usuarios', coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.dias_login DESC, l.acoes_itens+l.acoes_tst DESC, l.nome) FROM linhas l),'[]'),
    'por_dia', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.dia) FROM dia x),'[]'),
    'por_hora', coalesce((SELECT jsonb_agg(jsonb_build_object('hora',h,'logins',n) ORDER BY h) FROM hora),'[]'),
    'por_tipo', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo',t,'qtd',n) ORDER BY n DESC) FROM tipo),'[]')
  ) INTO res;
  RETURN res;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_usabilidade_sistema(date,date,uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_usabilidade_sistema(date,date,uuid) TO authenticated;