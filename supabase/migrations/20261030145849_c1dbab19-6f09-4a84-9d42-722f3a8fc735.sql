DO $$
DECLARE v_coord uuid; v_carlos uuid := '70ac117d-1317-4aca-bb5e-e092b74ad99c'; v_lucas uuid := 'a61dd616-56d1-4714-8429-e38a928d2c4c';
v_cond text := 'ADOBE ASSESSORIA DE SERVICOS CADASTRAIS | CREFISA SA CREDITO FINANCIAMENTO E INVESTIMENTOS';
v_adv text[] := ARRAY['15553/OSMAR MENDES PAIXAO CORTES','15553/OSMAR MENDES PAIXÃO CÔRTES','10424/CARLOS JOSE ELIAS JUNIOR','10424/CARLOS JOSÉ ELIAS JÚNIOR'];
BEGIN
  SELECT id INTO v_coord FROM coordenacoes WHERE nome = 'COORDENAÇÃO ADOBE/CREFISA';
  IF v_coord IS NULL THEN
    INSERT INTO coordenacoes (nome, area, coordenador_id, descricao)
    VALUES ('COORDENAÇÃO ADOBE/CREFISA', 'trabalhista', v_carlos, 'Publicações ADOBE e CREFISA (TRT10 e TST)')
    RETURNING id INTO v_coord;
  END IF;
  INSERT INTO membros_coordenacao (coordenacao_id, usuario_id, cargo)
  SELECT v_coord, u, c FROM (VALUES (v_carlos,'coordenador'),(v_lucas,'advogado')) x(u,c)
  WHERE NOT EXISTS (SELECT 1 FROM membros_coordenacao m WHERE m.coordenacao_id=v_coord AND m.usuario_id=x.u);

  INSERT INTO monitoramentos_djen (tipo, termo_busca, oab, uf, coordenacao_id, condicao_concomitante, termos_or, tribunais, buscar_parte, criado_por, descricao)
  VALUES
  ('advogado','OSMAR MENDES PAIXAO CORTES','15553','TODAS',v_coord,v_cond,v_adv,ARRAY['TRT10'],false,v_carlos,'ADOBE/CREFISA - TRT10'),
  ('advogado','OSMAR MENDES PAIXAO CORTES','15553','TODAS',v_coord,v_cond,v_adv || ARRAY['LUCAS CARREIRO'],ARRAY['TST'],false,v_carlos,'ADOBE/CREFISA - TST');
END $$;