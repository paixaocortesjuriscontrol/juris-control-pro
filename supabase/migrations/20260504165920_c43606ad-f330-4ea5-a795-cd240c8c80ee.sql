DO $mig$
DECLARE
  v_new_coord uuid;
  v_creator uuid := '59eb4c82-b654-4075-822d-8e2aed2535dc';
  v_old1 uuid := 'f73e8ee7-924c-4518-bbdc-62dd77df93a1';
  v_old2 uuid := 'd4e33fa2-e663-4d0c-909e-b2e15725591d';
BEGIN
  INSERT INTO public.coordenacoes (nome, area, coordenador_id, monitorar_redistribuicoes, monitorar_distribuicoes)
  VALUES ('Coordenação Dra. Janaina Completa', 'trabalhista', v_creator, true, true)
  RETURNING id INTO v_new_coord;

  INSERT INTO public.membros_coordenacao (coordenacao_id, usuario_id, cargo)
  SELECT v_new_coord, usuario_id,
         (ARRAY_AGG(cargo ORDER BY CASE WHEN coordenacao_id = v_old1 THEN 0 ELSE 1 END))[1]
  FROM public.membros_coordenacao
  WHERE coordenacao_id IN (v_old1, v_old2)
  GROUP BY usuario_id
  ON CONFLICT (coordenacao_id, usuario_id) DO NOTHING;

  INSERT INTO public.monitoramentos_djen (tipo, termo_busca, tribunais, ativo, criado_por, coordenacao_id) VALUES
  ('parte','ACREDITAR ONCOLOGIA', ARRAY['STF','STJ','TJDFT','TRT10'], true, v_creator, v_new_coord),
  ('parte','AGENCIA ESTADO', ARRAY['STF','STJ','TJDFT'], true, v_creator, v_new_coord),
  ('parte','ANIMA CENTRO HOSPITALAR', ARRAY['STF','STJ','TJGO','TRT18'], true, v_creator, v_new_coord),
  ('parte','BASE INVESTIMENTOS E INCORPORACOES', ARRAY['TRT1','TRT2','TRT3','TRT4','TRT5','TRT6','TRT7','TRT8','TRT9','TRT10','TRT11','TRT12','TRT13','TRT14','TRT15','TRT16','TRT17','TRT18','TRT19','TRT20','TRT21','TRT22','TRT23','TRT24'], true, v_creator, v_new_coord),
  ('parte','CARLOS JOSE ELIAS JUNIOR', ARRAY['STF','STJ','TJDFT','TJGO','TJMS','TJMT','TRT10','TRT18','TRT23','TRT24','TST'], true, v_creator, v_new_coord),
  ('parte','CEDIMAGEM CENTRO DE DIAGNOSTICO MEDICO POR IMAGEM', ARRAY['TRT23'], true, v_creator, v_new_coord),
  ('parte','CENTRAL PARK ESTACIONAMENTO', ARRAY['STF','STJ','TJDFT','TRT10'], true, v_creator, v_new_coord),
  ('parte','CENTRO RADIOLOGICO DE BRASILIA', ARRAY['STF','STJ','TJAC','TJAL','TJAM','TJAP','TJBA','TJCE','TJDFT','TJES','TJGO','TJMA','TJMG','TJMS','TJMT','TJPA','TJPB','TJPE','TJPI','TJPR','TJRJ','TJRN','TJRO','TJRR','TJRS','TJSC','TJSE','TJSP','TJTO','TRT10'], true, v_creator, v_new_coord),
  ('parte','CENTRO RADIOLOGICO DO GAMA', ARRAY['STF','STJ','TJDFT','TRT10'], true, v_creator, v_new_coord),
  ('parte','CLINICA CAMPO GRANDE', ARRAY['STF','STJ','TJMS','TRT24','TST'], true, v_creator, v_new_coord),
  ('parte','CLINICA SANTA ROSA', ARRAY['TRT23'], true, v_creator, v_new_coord),
  ('parte','HCBR HOSPITAL DO CORACAO', ARRAY['TRT10'], true, v_creator, v_new_coord),
  ('parte','HOSPITAIS INTEGRADOS DA GAVEA', ARRAY['STF','STJ','TJDFT','TRT10'], true, v_creator, v_new_coord),
  ('parte','HOSPITAL DE MEDICINA ESPECIALIZADA', ARRAY['STF','STJ','TJMT','TRT23'], true, v_creator, v_new_coord),
  ('parte','HOSPITAL DF STAR', ARRAY['STF','STJ','TJDFT'], true, v_creator, v_new_coord),
  ('parte','HOSPITAL DO CORACAO DO BRASIL', ARRAY['STF','STJ','TJDFT'], true, v_creator, v_new_coord),
  ('parte','HOSPITAL MARIA AUXILIADORA', ARRAY['STF','STJ','TJDFT','TRT10'], true, v_creator, v_new_coord),
  ('parte','HOSPITAL ORTOPEDICO', ARRAY['STF','STJ','TJMT','TRT23'], true, v_creator, v_new_coord),
  ('parte','HOSPITAL PLACI', ARRAY['STF','STJ','TJDFT'], true, v_creator, v_new_coord),
  ('parte','HOSPITAL PRONTONORTE', ARRAY['STF','STJ','TJDFT','TRT10'], true, v_creator, v_new_coord),
  ('parte','HOSPITAL SANTA HELENA', ARRAY['STF','STJ','TJDFT','TRT10'], true, v_creator, v_new_coord),
  ('parte','HOSPITAL SANTA LUCIA', ARRAY['STF','STJ','TJDFT','TRT10'], true, v_creator, v_new_coord),
  ('parte','HOSPITAL SANTA ROSA', ARRAY['STF','STJ','TJMT','TRT23'], true, v_creator, v_new_coord),
  ('parte','LABORATORIO SANTA ROSA', ARRAY['TRT23'], true, v_creator, v_new_coord),
  ('parte','MEDGRUPO PARTICIPACOES', ARRAY['STF','STJ','TJDFT','TRT10'], true, v_creator, v_new_coord),
  ('parte','MONTREAL INFORMATICA', ARRAY['STF','STJ','TJAC','TJAL','TJAM','TJAP','TJBA','TJCE','TJDFT','TJES','TJGO','TJMA','TJMG','TJMS','TJMT','TJPA','TJPB','TJPE','TJPI','TJPR','TJRJ','TJRN','TJRO','TJRR','TJRS','TJSC','TJSE','TJSP','TJTO'], true, v_creator, v_new_coord),
  ('parte','NEW HSH PARTICIPACOES', ARRAY['STF','STJ','TJDFT','TRT10'], true, v_creator, v_new_coord),
  ('parte','NEW YORK EMPREENDIMENTOS IMOBILIARIOS', ARRAY['TRT1','TRT2','TRT3','TRT4','TRT5','TRT6','TRT7','TRT8','TRT9','TRT10','TRT11','TRT12','TRT13','TRT14','TRT15','TRT16','TRT17','TRT18','TRT19','TRT20','TRT21','TRT22','TRT23','TRT24'], true, v_creator, v_new_coord),
  ('parte','PARQUE PLANALTO EMPREENDIMENTOS IMOBILIARIOS', ARRAY['TRT1','TRT2','TRT3','TRT4','TRT5','TRT6','TRT7','TRT8','TRT9','TRT10','TRT11','TRT12','TRT13','TRT14','TRT15','TRT16','TRT17','TRT18','TRT19','TRT20','TRT21','TRT22','TRT23','TRT24'], true, v_creator, v_new_coord),
  ('parte','PC SERVICE TECNOLOGIA', ARRAY['STF','STJ','TJAC','TJAL','TJAM','TJAP','TJBA','TJCE','TJDFT','TJES','TJGO','TJMA','TJMG','TJMS','TJMT','TJPA','TJPB','TJPE','TJPI','TJPR','TJRJ','TJRN','TJRO','TJRR','TJRS','TJSC','TJSE','TJSP','TJTO'], true, v_creator, v_new_coord),
  ('parte','POLICLINICAS MEDICAS SANTA LUCIA', ARRAY['STF','STJ','TJDFT','TRT10'], true, v_creator, v_new_coord),
  ('parte','PROCARDIO CENTRO CARDIO RESPIRATORIO', ARRAY['STF','STJ','TJAC','TJAL','TJAM','TJAP','TJBA','TJCE','TJDFT','TJES','TJGO','TJMA','TJMG','TJMS','TJMT','TJPA','TJPB','TJPE','TJPI','TJPR','TJRJ','TJRN','TJRO','TJRR','TJRS','TJSC','TJSE','TJSP','TJTO','TRT24'], true, v_creator, v_new_coord),
  ('parte','REDE D''OR SAO LUIZ', ARRAY['STF','STJ','TJDFT','TRT10'], true, v_creator, v_new_coord),
  ('parte','S.A. O ESTADO DE SAO PAULO', ARRAY['STF','STJ','TJDFT'], true, v_creator, v_new_coord),
  ('parte','SALUTE CLINICAS MEDICAS ESPECIALIZADAS', ARRAY['STF','STJ','TJDFT','TRT10'], true, v_creator, v_new_coord),
  ('parte','VIACAO PIRACICABANA', ARRAY['STF','STJ','TJDFT'], true, v_creator, v_new_coord),
  ('parte','VILLAGGIO PARK SUL EMPREENDIMENTOS IMOBILIARIOS', ARRAY['TRT1','TRT2','TRT3','TRT4','TRT5','TRT6','TRT7','TRT8','TRT9','TRT10','TRT11','TRT12','TRT13','TRT14','TRT15','TRT16','TRT17','TRT18','TRT19','TRT20','TRT21','TRT22','TRT23','TRT24'], true, v_creator, v_new_coord);
END
$mig$;