-- Criar monitoramentos DJEN para Coordenação Dra. Polyana Nava
-- criado_por: a318c5eb-c2cc-480a-952a-5c2a42b85fc6 (admin)
-- coordenacao_id: 42e2eb97-2a4d-4488-8df1-193d373d3fc9

-- TRT10 - Empresas principais
INSERT INTO monitoramentos_djen (tipo, termo_busca, coordenacao_id, ativo, tribunais, descricao, criado_por) VALUES
('parte', 'Centro Radiológico do Gama S/A', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt10'], 'TRT10 - Centro Radiológico do Gama', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'Hospital Maria Auxiliadora S/A', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt10'], 'TRT10 - Hospital Maria Auxiliadora', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'Hospital Santa Lucia Gama S/A', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt10'], 'TRT10 - Hospital Santa Lucia Gama', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'MEDGRUPO Participações S/A', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt10'], 'TRT10 - MEDGRUPO Participações', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'Centro Radiológico de Brasília S/A', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt10'], 'TRT10 - Centro Radiológico de Brasília', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'Hospital Santa Lucia S/A', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt10'], 'TRT10 - Hospital Santa Lucia', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'Hospital Santa Lucia Sul S/A', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt10'], 'TRT10 - Hospital Santa Lucia Sul', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'Hospital Santa Taguatinga S/A', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt10'], 'TRT10 - Hospital Santa Taguatinga', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'Hospital Prontornorte S/A', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt10'], 'TRT10 - Hospital Prontornorte', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'Hospital Santa Lucia Norte S/A', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt10'], 'TRT10 - Hospital Santa Lucia Norte', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'NEW HSH PARTICIPAÇÕES S/A', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt10'], 'TRT10 - NEW HSH Participações', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'POLICLÍNICAS MÉDICA SANTA LÚCIA LTDA', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt10'], 'TRT10 - Policlínicas Médica Santa Lúcia', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'CENTRAL PARK ESTACIONAMENTO LTDA', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt10'], 'TRT10 - Central Park Estacionamento', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),

-- TRT18 - Goiás
('parte', 'Ânima Centro Hospitalar LTDA', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt18'], 'TRT18 - Ânima Centro Hospitalar', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),

-- TRT23 - Mato Grosso
('parte', 'Hospital de Medicina Especializada S/A', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt23'], 'TRT23 - Hospital de Medicina Especializada', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'CLÍNICA SANTA ROSA LTDA', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt23'], 'TRT23 - Clínica Santa Rosa', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'CEDIMAGEM CENTRO DE DIAGNOSTICO MEDICO POR IMAGEM S.A.', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt23'], 'TRT23 - Cedimagem', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'LABORATÓRIO SANTA ROSA LTDA.', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt23'], 'TRT23 - Laboratório Santa Rosa', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'HOSPITAL SANTA ROSA S.A.', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt23'], 'TRT23 - Hospital Santa Rosa', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'HOSPITAL ORTOPÉDICO LTDA', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt23'], 'TRT23 - Hospital Ortopédico', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),

-- TRT24 - Mato Grosso do Sul
('parte', 'CLÍNICA CAMPO GRANDE S.A.', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt24'], 'TRT24 - Clínica Campo Grande (Hospital do Coração)', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'CLINICA DE CAMPO GRANDE S/A', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt24'], 'TRT24 - Clinica de Campo Grande', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'PROCARDIO CENTRO CARDIO RESPIRATORIO LTDA', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', true, ARRAY['trt24'], 'TRT24 - Procárdio', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),

-- GRUPO REDE D'OR - TRT10 (INATIVOS - aguardando confirmação Dra. Polyana)
('parte', 'Hospitais Integrados da Gávea', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', false, ARRAY['trt10'], 'TRT10 - Hospital DF Star (Rede DOr - A CONFIRMAR)', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'Hospital Santa Helena S/A', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', false, ARRAY['trt10'], 'TRT10 - Hospital Santa Helena (Rede DOr - A CONFIRMAR)', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'Hospital Santa Luzia S/A', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', false, ARRAY['trt10'], 'TRT10 - Hospital Santa Luzia (Rede DOr - A CONFIRMAR)', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'Salute Clínicas Médicas Especializadas', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', false, ARRAY['trt10'], 'TRT10 - Salute Clínicas (Rede DOr - A CONFIRMAR)', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'Rede D''Or São Luiz S.A.', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', false, ARRAY['trt10'], 'TRT10 - Rede DOr São Luiz (Rede DOr - A CONFIRMAR)', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'Acreditar Oncologia', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', false, ARRAY['trt10'], 'TRT10 - Acreditar Oncologia (Rede DOr - A CONFIRMAR)', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6'),
('parte', 'HCBR Hospital do Coração', '42e2eb97-2a4d-4488-8df1-193d373d3fc9', false, ARRAY['trt10'], 'TRT10 - Hospital do Coração HCBR (Rede DOr - A CONFIRMAR)', 'a318c5eb-c2cc-480a-952a-5c2a42b85fc6');