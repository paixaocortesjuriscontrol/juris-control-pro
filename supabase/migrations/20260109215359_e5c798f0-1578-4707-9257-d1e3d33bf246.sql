-- Cadastrar termos de monitoramento DJEN para Coordenação Dra. Janaína
INSERT INTO monitoramentos_djen (termo_busca, tipo, coordenacao_id, criado_por, ativo, tribunais, descricao)
VALUES 
-- DF - TRT10
('HOSPITAL SANTA LÚCIA S/A', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT10'], 'Hospital Santa Lúcia Sul - DF'),
('HOSPITAL MARIA AUXILIADORA S/A', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT10'], 'Hospital Santa Lúcia Gama - DF'),
('HOSPITAL PRONTONORTE S/A', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT10'], 'Hospital Santa Lúcia Norte - DF'),
('HOSPITAL SANTA LÚCIA TAGUATINGA S/A', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT10'], 'DF'),
('CENTRO RADIOLOGICO DE BRASILIA S/A', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT10'], 'DF'),
('CENTRO RADIOLÓGICO DO GAMA S/A', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT10'], 'DF'),
('NEW HSH PARTICIPAÇÕES S/A', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT10'], 'DF'),
('POLICLÍNICAS MÉDICA SANTA LÚCIA LTDA', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT10'], 'DF'),
('CENTRAL PARK ESTACIONAMENTO LTDA', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT10'], 'DF'),
('MEDGRUPO PARTICIPAÇÕES S/A', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT10'], 'DF'),
-- GO - TRT18
('ÂNIMA CENTRO HOSPITALAR LTDA', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT18'], 'GO'),
-- MT - TRT23
('CLÍNICA SANTA ROSA LTDA', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT23'], 'MT'),
('CEDIMAGEM CENTRO DE DIAGNOSTICO MEDICO POR IMAGEM S.A.', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT23'], 'MT'),
('HOSPITAL DE MEDICINA ESPECIALIZADA S.A.', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT23'], 'MT'),
('LABORATÓRIO SANTA ROSA LTDA.', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT23'], 'MT'),
('HOSPITAL SANTA ROSA S.A.', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT23'], 'MT'),
('HOSPITAL ORTOPÉDICO LTDA', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT23'], 'MT'),
-- MS - TRT24
('CLÍNICA CAMPO GRANDE S.A.', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT24'], 'Hospital do Coração - MS'),
('PROCARDIO CENTRO CARDIO RESPIRATORIO LTDA', 'parte', 'f73e8ee7-924c-4518-bbdc-62dd77df93a1', '59eb4c82-b654-4075-822d-8e2aed2535dc', true, ARRAY['TRT24'], 'Procárdio - MS');