
-- Atribuição em massa de responsáveis aos processos da Distribuição TST
-- Coordenação Dra. Renata Santander, baseada no mês de data_distribuicao_planilha

DO $$
DECLARE
  v_coord_id UUID := '3e47fc83-3539-4fa7-9fcf-33825120e1b7';
  -- IDs dos perfis
  v_lienne UUID := 'b6ad7321-65fa-41ff-bff2-bdace43c9f66';
  v_paula UUID := '569b733e-05f3-423f-8912-974532b413cd';
  v_priscila UUID := '91ac1340-71e8-4c33-8e82-e96c88dfb5a3';
  v_anna UUID := '1f1cd620-6017-450e-97cf-6006471039ab';
  v_tais UUID := '5bb5e8e9-aa34-4dba-b919-4d2a928c204a';
  v_daniela UUID := '7aabe768-fb5a-487d-865e-4070b60b64a3';
  v_kellen UUID := 'c9d87dfd-18d2-417d-81c6-17748ab61e80';
  v_tatiana UUID := 'cd8a5000-a53f-4aff-9613-e8d25f167b08';
BEGIN
  -- Limpar atribuições existentes apenas dos processos a serem reatribuidos
  DELETE FROM public.dados_benner_responsaveis
  WHERE dados_benner_id IN (
    SELECT id FROM public.dados_benner
    WHERE coordenacao_id = v_coord_id
      AND aba_origem IS NOT NULL
      AND data_distribuicao_planilha IS NOT NULL
      AND EXTRACT(MONTH FROM data_distribuicao_planilha)::int IN (8, 9, 10, 11, 12)
  );

  -- OUTUBRO (mes=10): Lienne + Paula Brunna
  INSERT INTO public.dados_benner_responsaveis (dados_benner_id, usuario_id)
  SELECT db.id, uid FROM public.dados_benner db
  CROSS JOIN (VALUES (v_lienne), (v_paula)) AS u(uid)
  WHERE db.coordenacao_id = v_coord_id
    AND db.aba_origem IS NOT NULL
    AND EXTRACT(MONTH FROM db.data_distribuicao_planilha)::int = 10
  ON CONFLICT DO NOTHING;

  -- NOVEMBRO (mes=11): Priscila + Anna
  INSERT INTO public.dados_benner_responsaveis (dados_benner_id, usuario_id)
  SELECT db.id, uid FROM public.dados_benner db
  CROSS JOIN (VALUES (v_priscila), (v_anna)) AS u(uid)
  WHERE db.coordenacao_id = v_coord_id
    AND db.aba_origem IS NOT NULL
    AND EXTRACT(MONTH FROM db.data_distribuicao_planilha)::int = 11
  ON CONFLICT DO NOTHING;

  -- DEZEMBRO (mes=12): Taís
  INSERT INTO public.dados_benner_responsaveis (dados_benner_id, usuario_id)
  SELECT db.id, v_tais FROM public.dados_benner db
  WHERE db.coordenacao_id = v_coord_id
    AND db.aba_origem IS NOT NULL
    AND EXTRACT(MONTH FROM db.data_distribuicao_planilha)::int = 12
  ON CONFLICT DO NOTHING;

  -- SETEMBRO (mes=9): Daniela + Kellen
  INSERT INTO public.dados_benner_responsaveis (dados_benner_id, usuario_id)
  SELECT db.id, uid FROM public.dados_benner db
  CROSS JOIN (VALUES (v_daniela), (v_kellen)) AS u(uid)
  WHERE db.coordenacao_id = v_coord_id
    AND db.aba_origem IS NOT NULL
    AND EXTRACT(MONTH FROM db.data_distribuicao_planilha)::int = 9
  ON CONFLICT DO NOTHING;

  -- AGOSTO (mes=8): Tatiana
  INSERT INTO public.dados_benner_responsaveis (dados_benner_id, usuario_id)
  SELECT db.id, v_tatiana FROM public.dados_benner db
  WHERE db.coordenacao_id = v_coord_id
    AND db.aba_origem IS NOT NULL
    AND EXTRACT(MONTH FROM db.data_distribuicao_planilha)::int = 8
  ON CONFLICT DO NOTHING;
END $$;
