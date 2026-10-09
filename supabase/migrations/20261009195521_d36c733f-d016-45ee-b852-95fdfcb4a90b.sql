CREATE OR REPLACE FUNCTION public._importar_relatorio_gol(_recs jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _gol uuid := 'f5a0ac48-7461-49c1-9151-219e570831bd';
  _cli uuid := '0122704b-b6df-4ef5-9a3a-2061c30bea97';
  r jsonb; b jsonb; n processos; _id uuid; _coord uuid;
  novos int := 0; atual int := 0; adic int := 0;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _mapa(d text primary key, id uuid, coord uuid) ON COMMIT DROP;
  TRUNCATE _mapa;
  INSERT INTO _mapa
  SELECT DISTINCT ON (dg) dg, p.id, p.coordenacao_id FROM (
    SELECT regexp_replace(coalesce(p.numero,''),'\D','','g') dg, p.* FROM processos p) p
  WHERE dg IN (SELECT coalesce(e->>'digits', regexp_replace(e->>'numero','\D','','g')) FROM jsonb_array_elements(_recs) e)
  ORDER BY dg, p.created_at;

  FOR r IN SELECT * FROM jsonb_array_elements(_recs) LOOP
    b := r->'b';
    n := jsonb_populate_record(null::processos, b);
    SELECT id, coord INTO _id, _coord FROM _mapa WHERE d = coalesce(r->>'digits', regexp_replace(r->>'numero','\D','','g'));
    IF _id IS NULL THEN
      INSERT INTO processos(numero, cliente_id, coordenacao_id, area, status, tipo_processo, dossie_tst, reclamante, reclamados, polo_ativo, polo_passivo,
        cpf_cnpj_parte_contraria, data_desligamento, data_distribuicao, funcao, empresa_terceirizada, uf, comarca, vara, pedidos, fase, andamento_atual,
        valor_causa, data_encerramento, provisionamento_remoto, provisionamento_possivel, provisionamento_provavel, observacoes_processo, auto_infracao,
        transitado_julgado, risco, natureza, dados_relatorio_cliente, relatorio_origem)
      VALUES (r->>'numero', _cli, _gol, 'trabalhista', (r->>'status')::status_processo, 'judicial', n.dossie_tst, n.reclamante, n.reclamados, n.polo_ativo, n.polo_passivo,
        n.cpf_cnpj_parte_contraria, n.data_desligamento, n.data_distribuicao, n.funcao, n.empresa_terceirizada, n.uf, n.comarca, n.vara, n.pedidos, n.fase, n.andamento_atual,
        n.valor_causa, n.data_encerramento, n.provisionamento_remoto, n.provisionamento_possivel, n.provisionamento_provavel, n.observacoes_processo, n.auto_infracao,
        coalesce(n.transitado_julgado,false), n.risco, n.natureza, coalesce(r->'x','{}'), r->>'origem')
      RETURNING id INTO _id;
      INSERT INTO _mapa VALUES (coalesce(r->>'digits', regexp_replace(r->>'numero','\D','','g')), _id, _gol) ON CONFLICT DO NOTHING;
      novos := novos + 1;
    ELSE
      UPDATE processos p SET
        dossie_tst = coalesce(nullif(p.dossie_tst,''), n.dossie_tst), reclamante = coalesce(nullif(p.reclamante,''), n.reclamante),
        reclamados = coalesce(nullif(p.reclamados,''), n.reclamados), polo_ativo = coalesce(nullif(p.polo_ativo,''), n.polo_ativo),
        polo_passivo = coalesce(nullif(p.polo_passivo,''), n.polo_passivo), cpf_cnpj_parte_contraria = coalesce(nullif(p.cpf_cnpj_parte_contraria,''), n.cpf_cnpj_parte_contraria),
        data_desligamento = coalesce(p.data_desligamento, n.data_desligamento), data_distribuicao = coalesce(p.data_distribuicao, n.data_distribuicao),
        funcao = coalesce(nullif(p.funcao,''), n.funcao), empresa_terceirizada = coalesce(nullif(p.empresa_terceirizada,''), n.empresa_terceirizada),
        uf = coalesce(nullif(p.uf,''), n.uf), comarca = coalesce(nullif(p.comarca,''), n.comarca), vara = coalesce(nullif(p.vara,''), n.vara),
        pedidos = coalesce(nullif(p.pedidos,''), n.pedidos), fase = coalesce(nullif(p.fase,''), n.fase), andamento_atual = coalesce(nullif(p.andamento_atual,''), n.andamento_atual),
        valor_causa = coalesce(p.valor_causa, n.valor_causa), data_encerramento = coalesce(p.data_encerramento, n.data_encerramento),
        provisionamento_remoto = coalesce(p.provisionamento_remoto, n.provisionamento_remoto), provisionamento_possivel = coalesce(p.provisionamento_possivel, n.provisionamento_possivel),
        provisionamento_provavel = coalesce(p.provisionamento_provavel, n.provisionamento_provavel), observacoes_processo = coalesce(nullif(p.observacoes_processo,''), n.observacoes_processo),
        auto_infracao = coalesce(nullif(p.auto_infracao,''), n.auto_infracao), risco = coalesce(nullif(p.risco,''), n.risco), natureza = coalesce(nullif(p.natureza,''), n.natureza),
        cliente_id = coalesce(p.cliente_id, _cli),
        dados_relatorio_cliente = coalesce(r->'x','{}') || coalesce(p.dados_relatorio_cliente,'{}'),
        relatorio_origem = coalesce(p.relatorio_origem, r->>'origem')
      WHERE p.id = _id;
      atual := atual + 1;
      IF _coord IS DISTINCT FROM _gol THEN
        INSERT INTO processos_coordenacoes_responsaveis(processo_id, coordenacao_id, principal)
        SELECT _id, _gol, false WHERE NOT EXISTS (SELECT 1 FROM processos_coordenacoes_responsaveis WHERE processo_id=_id AND coordenacao_id=_gol);
        IF FOUND THEN adic := adic + 1; END IF;
      END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('novos',novos,'atualizados',atual,'gol_adicional',adic);
END $$;
REVOKE ALL ON FUNCTION public._importar_relatorio_gol(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._importar_relatorio_gol(jsonb) TO service_role;