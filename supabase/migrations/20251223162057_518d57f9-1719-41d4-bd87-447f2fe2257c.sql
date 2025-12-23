
-- Inserir monitoramentos DJEN para Dr. Thomás
-- Coordenacao ID: b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f
-- Criado por (Thomás): d85dcffc-732d-4ec3-adb7-13b10a5115b7

-- ===== TJDFT - OABs (sem exclusões) =====
INSERT INTO public.monitoramentos_djen (criado_por, coordenacao_id, tipo, termo_busca, oab, uf, tribunais, exclusoes, descricao, ativo)
VALUES 
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 27284 TJDFT', '27284', 'DF', ARRAY['TJDFT'], ARRAY[]::text[], 'Monitoramento TJDFT - OAB 27284', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 27022 TJDFT', '27022', 'DF', ARRAY['TJDFT'], ARRAY[]::text[], 'Monitoramento TJDFT - OAB 27022', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 10424 TJDFT', '10424', 'DF', ARRAY['TJDFT'], ARRAY[]::text[], 'Monitoramento TJDFT - OAB 10424', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 25181 TJDFT', '25181', 'DF', ARRAY['TJDFT'], ARRAY[]::text[], 'Monitoramento TJDFT - OAB 25181', true);

-- ===== TJDFT - Nomes Advogados (sem exclusões) =====
INSERT INTO public.monitoramentos_djen (criado_por, coordenacao_id, tipo, termo_busca, uf, tribunais, exclusoes, descricao, ativo)
VALUES 
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'OSMAR MENDES', 'DF', ARRAY['TJDFT'], ARRAY[]::text[], 'Monitoramento TJDFT - Adv. Osmar Mendes', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'CARLOS JOSE ELIAS', 'DF', ARRAY['TJDFT'], ARRAY[]::text[], 'Monitoramento TJDFT - Adv. Carlos Jose Elias', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'THOMAS RIETH', 'DF', ARRAY['TJDFT'], ARRAY[]::text[], 'Monitoramento TJDFT - Adv. Thomas Rieth', true);

-- ===== TRF-1/JFDF - OABs (sem exclusões) =====
INSERT INTO public.monitoramentos_djen (criado_por, coordenacao_id, tipo, termo_busca, oab, uf, tribunais, exclusoes, descricao, ativo)
VALUES 
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 15553 TRF1', '15553', 'DF', ARRAY['TRF1', 'JFDF'], ARRAY[]::text[], 'Monitoramento TRF1/JFDF - OAB 15553', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 27284 TRF1', '27284', 'DF', ARRAY['TRF1', 'JFDF'], ARRAY[]::text[], 'Monitoramento TRF1/JFDF - OAB 27284', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 27022 TRF1', '27022', 'DF', ARRAY['TRF1', 'JFDF'], ARRAY[]::text[], 'Monitoramento TRF1/JFDF - OAB 27022', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 10424 TRF1', '10424', 'DF', ARRAY['TRF1', 'JFDF'], ARRAY[]::text[], 'Monitoramento TRF1/JFDF - OAB 10424', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 25181 TRF1', '25181', 'DF', ARRAY['TRF1', 'JFDF'], ARRAY[]::text[], 'Monitoramento TRF1/JFDF - OAB 25181', true);

-- ===== TRF-1/JFDF - Nomes Advogados (sem exclusões) =====
INSERT INTO public.monitoramentos_djen (criado_por, coordenacao_id, tipo, termo_busca, uf, tribunais, exclusoes, descricao, ativo)
VALUES 
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'OSMAR MENDES', 'DF', ARRAY['TRF1', 'JFDF'], ARRAY[]::text[], 'Monitoramento TRF1/JFDF - Adv. Osmar Mendes', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'CARLOS JOSE ELIAS', 'DF', ARRAY['TRF1', 'JFDF'], ARRAY[]::text[], 'Monitoramento TRF1/JFDF - Adv. Carlos Jose Elias', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'THOMAS RIETH', 'DF', ARRAY['TRF1', 'JFDF'], ARRAY[]::text[], 'Monitoramento TRF1/JFDF - Adv. Thomas Rieth', true);

-- ===== STJ - OABs (sem exclusões) =====
INSERT INTO public.monitoramentos_djen (criado_por, coordenacao_id, tipo, termo_busca, oab, uf, tribunais, exclusoes, descricao, ativo)
VALUES 
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 15553 STJ', '15553', 'DF', ARRAY['STJ'], ARRAY[]::text[], 'Monitoramento STJ - OAB 15553', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 27284 STJ', '27284', 'DF', ARRAY['STJ'], ARRAY[]::text[], 'Monitoramento STJ - OAB 27284', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 27022 STJ', '27022', 'DF', ARRAY['STJ'], ARRAY[]::text[], 'Monitoramento STJ - OAB 27022', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 10424 STJ', '10424', 'DF', ARRAY['STJ'], ARRAY[]::text[], 'Monitoramento STJ - OAB 10424', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 25181 STJ', '25181', 'DF', ARRAY['STJ'], ARRAY[]::text[], 'Monitoramento STJ - OAB 25181', true);

-- ===== STJ - Nomes Advogados (sem exclusões) =====
INSERT INTO public.monitoramentos_djen (criado_por, coordenacao_id, tipo, termo_busca, uf, tribunais, exclusoes, descricao, ativo)
VALUES 
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'OSMAR MENDES', 'DF', ARRAY['STJ'], ARRAY[]::text[], 'Monitoramento STJ - Adv. Osmar Mendes', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'CARLOS JOSE ELIAS', 'DF', ARRAY['STJ'], ARRAY[]::text[], 'Monitoramento STJ - Adv. Carlos Jose Elias', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'THOMAS RIETH', 'DF', ARRAY['STJ'], ARRAY[]::text[], 'Monitoramento STJ - Adv. Thomas Rieth', true);

-- ===== TJGO - OABs (COM exclusões: SANTANDER, BRADESCO, AYMORÉ) =====
INSERT INTO public.monitoramentos_djen (criado_por, coordenacao_id, tipo, termo_busca, oab, uf, tribunais, exclusoes, descricao, ativo)
VALUES 
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 15553 TJGO', '15553', 'GO', ARRAY['TJGO'], ARRAY['SANTANDER', 'BRADESCO', 'AYMORÉ'], 'Monitoramento TJGO - OAB 15553', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 27284 TJGO', '27284', 'GO', ARRAY['TJGO'], ARRAY['SANTANDER', 'BRADESCO', 'AYMORÉ'], 'Monitoramento TJGO - OAB 27284', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 27022 TJGO', '27022', 'GO', ARRAY['TJGO'], ARRAY['SANTANDER', 'BRADESCO', 'AYMORÉ'], 'Monitoramento TJGO - OAB 27022', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 10424 TJGO', '10424', 'GO', ARRAY['TJGO'], ARRAY['SANTANDER', 'BRADESCO', 'AYMORÉ'], 'Monitoramento TJGO - OAB 10424', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 25181 TJGO', '25181', 'GO', ARRAY['TJGO'], ARRAY['SANTANDER', 'BRADESCO', 'AYMORÉ'], 'Monitoramento TJGO - OAB 25181', true);

-- ===== TJGO - Nomes Advogados (COM exclusões) =====
INSERT INTO public.monitoramentos_djen (criado_por, coordenacao_id, tipo, termo_busca, uf, tribunais, exclusoes, descricao, ativo)
VALUES 
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'OSMAR MENDES', 'GO', ARRAY['TJGO'], ARRAY['SANTANDER', 'BRADESCO', 'AYMORÉ'], 'Monitoramento TJGO - Adv. Osmar Mendes', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'CARLOS JOSE ELIAS', 'GO', ARRAY['TJGO'], ARRAY['SANTANDER', 'BRADESCO', 'AYMORÉ'], 'Monitoramento TJGO - Adv. Carlos Jose Elias', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'THOMAS RIETH', 'GO', ARRAY['TJGO'], ARRAY['SANTANDER', 'BRADESCO', 'AYMORÉ'], 'Monitoramento TJGO - Adv. Thomas Rieth', true);

-- ===== TJSP - OABs específicas (COM exclusões) =====
INSERT INTO public.monitoramentos_djen (criado_por, coordenacao_id, tipo, termo_busca, oab, uf, tribunais, exclusoes, descricao, ativo)
VALUES 
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 15553 TJSP', '15553', 'SP', ARRAY['TJSP'], ARRAY['SANTANDER', 'BRADESCO', 'AYMORÉ'], 'Monitoramento TJSP - OAB 15553', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 310314 TJSP', '310314', 'SP', ARRAY['TJSP'], ARRAY['SANTANDER', 'BRADESCO', 'AYMORÉ'], 'Monitoramento TJSP - OAB 310314', true);

-- ===== TJSP - Nome Advogado (COM exclusões) =====
INSERT INTO public.monitoramentos_djen (criado_por, coordenacao_id, tipo, termo_busca, uf, tribunais, exclusoes, descricao, ativo)
VALUES 
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'OSMAR MENDES', 'SP', ARRAY['TJSP'], ARRAY['SANTANDER', 'BRADESCO', 'AYMORÉ'], 'Monitoramento TJSP - Adv. Osmar Mendes', true);

-- ===== Razões Sociais em todos os TJs Cíveis =====
INSERT INTO public.monitoramentos_djen (criado_por, coordenacao_id, tipo, termo_busca, tribunais, exclusoes, descricao, ativo)
VALUES 
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'parte', 'Anovis Industrial Farmacêutica LTDA', NULL, ARRAY[]::text[], 'Razão Social - Anovis Industrial Farmacêutica - Todos TJs Cíveis', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'parte', 'União Quimica Farmacêutica Nacional S/A', NULL, ARRAY[]::text[], 'Razão Social - União Química - Todos TJs Cíveis', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'parte', 'F & F Distribuidora de Produtos Farmacêuticos LTDA', NULL, ARRAY[]::text[], 'Razão Social - F&F Distribuidora - Todos TJs Cíveis', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'parte', 'UQ Industria Gráfica e de Embalagens LTDA', NULL, ARRAY[]::text[], 'Razão Social - UQ Indústria Gráfica - Todos TJs Cíveis', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'parte', 'Laboratil Farmacêutica LTDA', NULL, ARRAY[]::text[], 'Razão Social - Laboratil Farmacêutica - Todos TJs Cíveis', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'parte', 'Inovat Industria Farmacêutica LTDA', NULL, ARRAY[]::text[], 'Razão Social - Inovat Indústria - Todos TJs Cíveis', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'parte', 'Claris Produtos Farmacêuticos do Brasil LTDA', NULL, ARRAY[]::text[], 'Razão Social - Claris Produtos - Todos TJs Cíveis', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'parte', 'União Química Internacional Ltda', NULL, ARRAY[]::text[], 'Razão Social - União Química Internacional - Todos TJs Cíveis', true);

-- ===== Trabalhistas - OAB Dr. Osmar + BRADESCO =====
INSERT INTO public.monitoramentos_djen (criado_por, coordenacao_id, tipo, termo_busca, oab, uf, tribunais, exclusoes, condicao_concomitante, descricao, ativo)
VALUES 
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'advogado', 'OAB 15553 + BRADESCO Trabalhista', '15553', 'DF', NULL, ARRAY[]::text[], 'BRADESCO', 'Trabalhista - OAB 15553 + BRADESCO - Todos TRTs', true);

-- ===== Trabalhistas - Nome OSMAR MENDES + BRADESCO =====
INSERT INTO public.monitoramentos_djen (criado_por, coordenacao_id, tipo, termo_busca, tribunais, exclusoes, condicao_concomitante, descricao, ativo)
VALUES 
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'OSMAR MENDES', NULL, ARRAY[]::text[], 'BRADESCO', 'Trabalhista - Adv. Osmar Mendes + BRADESCO - Todos TRTs', true);

-- ===== Trabalhistas - Nome OSMAR MENDES + Empresas diversas =====
INSERT INTO public.monitoramentos_djen (criado_por, coordenacao_id, tipo, termo_busca, tribunais, exclusoes, condicao_concomitante, descricao, ativo)
VALUES 
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'OSMAR MENDES', NULL, ARRAY[]::text[], 'SERVIÇO DE APOIO', 'Trabalhista - Osmar + Serviço de Apoio', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'OSMAR MENDES', NULL, ARRAY[]::text[], 'SERVIÇO BRASILEIRO DE APOIO', 'Trabalhista - Osmar + Serviço Brasileiro de Apoio', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'OSMAR MENDES', NULL, ARRAY[]::text[], 'MONTREAL', 'Trabalhista - Osmar + Montreal', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'OSMAR MENDES', NULL, ARRAY[]::text[], 'PC SERVICE', 'Trabalhista - Osmar + PC Service', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'OSMAR MENDES', NULL, ARRAY[]::text[], 'NEW YORK EMPREENDIMENTOS IMOBILIÁRIOS S.A', 'Trabalhista - Osmar + New York Empreendimentos', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'OSMAR MENDES', NULL, ARRAY[]::text[], 'PARQUE PLANALTO EMPREENDIMENTOS IMOBILIÁRIOS S/A', 'Trabalhista - Osmar + Parque Planalto', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'OSMAR MENDES', NULL, ARRAY[]::text[], 'BASE INVESTIMENTOS E INCORPORAÇÕES S/A', 'Trabalhista - Osmar + Base Investimentos', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'OSMAR MENDES', NULL, ARRAY[]::text[], 'VILLAGGIO PARK SUL EMPREENDIMENTOS IMOBILIARIOS S.A', 'Trabalhista - Osmar + Villaggio Park Sul', true),
  ('d85dcffc-732d-4ec3-adb7-13b10a5115b7', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'nome', 'OSMAR MENDES', NULL, ARRAY[]::text[], 'SUPER QUADRA', 'Trabalhista - Osmar + Super Quadra', true);
