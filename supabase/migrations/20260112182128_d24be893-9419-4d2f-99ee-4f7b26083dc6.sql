-- =============================================
-- MESCLAGEM DE CLIENTES DUPLICADOS
-- Reatribui processos, grupos e pastas aos clientes canônicos
-- =============================================

-- 1. ACREDITAR ONCOLOGIA (canônico: 29f4edfc-4eec-4180-bf65-9676a6bf56c7)
-- Mesclar: Acreditar Oncologia - Matriz (297fa9be-f8fc-4160-8cc5-1806941fa3ee)
UPDATE processos SET cliente_id = '29f4edfc-4eec-4180-bf65-9676a6bf56c7', nome_cliente_envolvido = 'Acreditar Oncologia' WHERE cliente_id = '297fa9be-f8fc-4160-8cc5-1806941fa3ee';
UPDATE pastas SET cliente_id = '29f4edfc-4eec-4180-bf65-9676a6bf56c7' WHERE cliente_id = '297fa9be-f8fc-4160-8cc5-1806941fa3ee';
UPDATE clientes_grupos SET cliente_id = '29f4edfc-4eec-4180-bf65-9676a6bf56c7' WHERE cliente_id = '297fa9be-f8fc-4160-8cc5-1806941fa3ee' AND NOT EXISTS (SELECT 1 FROM clientes_grupos cg2 WHERE cg2.cliente_id = '29f4edfc-4eec-4180-bf65-9676a6bf56c7' AND cg2.grupo_id = clientes_grupos.grupo_id);
DELETE FROM clientes_grupos WHERE cliente_id = '297fa9be-f8fc-4160-8cc5-1806941fa3ee';
DELETE FROM clientes WHERE id = '297fa9be-f8fc-4160-8cc5-1806941fa3ee';

-- 2. ÂNIMA CENTRO HOSPITALAR LTDA (canônico: 0a6106c5-6d55-4131-bf58-b8098518e8a4)
-- Mesclar variações
UPDATE processos SET cliente_id = '0a6106c5-6d55-4131-bf58-b8098518e8a4', nome_cliente_envolvido = 'Ânima Centro Hospitalar LTDA' WHERE cliente_id IN ('1936b65d-ee11-43db-9554-e3351be528c8', 'a95a25d6-fadd-447c-ab13-264ae2055b08', '1cb06d9b-d660-4ac9-b8fc-90903fbce956');
UPDATE pastas SET cliente_id = '0a6106c5-6d55-4131-bf58-b8098518e8a4' WHERE cliente_id IN ('1936b65d-ee11-43db-9554-e3351be528c8', 'a95a25d6-fadd-447c-ab13-264ae2055b08', '1cb06d9b-d660-4ac9-b8fc-90903fbce956');
DELETE FROM clientes_grupos WHERE cliente_id IN ('1936b65d-ee11-43db-9554-e3351be528c8', 'a95a25d6-fadd-447c-ab13-264ae2055b08', '1cb06d9b-d660-4ac9-b8fc-90903fbce956');
DELETE FROM clientes WHERE id IN ('1936b65d-ee11-43db-9554-e3351be528c8', 'a95a25d6-fadd-447c-ab13-264ae2055b08', '1cb06d9b-d660-4ac9-b8fc-90903fbce956');

-- 3. HOSPITAL DO CORAÇÃO (canônico: de2b3d09-70b7-4cf1-a9e5-cfa638cd38da)
UPDATE processos SET cliente_id = 'de2b3d09-70b7-4cf1-a9e5-cfa638cd38da', nome_cliente_envolvido = 'Hospital do Coração' WHERE cliente_id = 'e6ad2a48-3dd1-4aee-8db3-c6a725ef903b';
UPDATE pastas SET cliente_id = 'de2b3d09-70b7-4cf1-a9e5-cfa638cd38da' WHERE cliente_id = 'e6ad2a48-3dd1-4aee-8db3-c6a725ef903b';
DELETE FROM clientes_grupos WHERE cliente_id = 'e6ad2a48-3dd1-4aee-8db3-c6a725ef903b';
DELETE FROM clientes WHERE id = 'e6ad2a48-3dd1-4aee-8db3-c6a725ef903b';

-- 4. HOSPITAL MARIA AUXILIADORA S/A (canônico: 2168ba7e-8d9f-4919-a415-1ae5076aeae3)
-- Mesclar: HMA, TOP SERVICE; HMA, HSH, ALT INFORMATICA; CRG, HMA; HMA, FOX; CRG e HMA; HMA, CRG, FOX
UPDATE processos SET cliente_id = '2168ba7e-8d9f-4919-a415-1ae5076aeae3', nome_cliente_envolvido = 'Hospital Maria Auxiliadora S/A' WHERE cliente_id IN (
  '0134a6b4-210d-4e51-83d2-cd8f82933d7b', -- HMA, TOP SERVICE
  '5d2fbbeb-4396-4970-9606-a5c0ada5ef4a', -- HMA, HSH, ALT INFORMATICA
  'fb76cade-80c8-48d5-b7d4-d5bc88617c08', -- CRG, HMA
  '8f04b2ff-ca11-493f-854d-b97aea1cf321', -- HMA, FOX
  'b30ee2a0-bdc4-4192-8f3d-f4f942faca31', -- CRG e HMA
  'f48bf56b-a725-45d6-a0cb-d7fdc902e0c1', -- HMA, CRG, FOX
  'eeca11e8-05ec-470e-ba82-104129d40d0c', -- Hospital Maria Auxiliadora S/A, Hospital Santa Lucia S/A
  'ebe138fc-e309-49dc-849f-7f85d3142bee', -- Hospital Maria Auxiliadora S/A, Hospital Santa Lúcia S/A
  'dab2e49a-816e-458b-8d13-a2da21bbb3ff'  -- Hospital Maria Auxiliadora S/A, TOP SERVICE SERVICOS E SISTEMAS
);
UPDATE pastas SET cliente_id = '2168ba7e-8d9f-4919-a415-1ae5076aeae3' WHERE cliente_id IN (
  '0134a6b4-210d-4e51-83d2-cd8f82933d7b', '5d2fbbeb-4396-4970-9606-a5c0ada5ef4a', 'fb76cade-80c8-48d5-b7d4-d5bc88617c08',
  '8f04b2ff-ca11-493f-854d-b97aea1cf321', 'b30ee2a0-bdc4-4192-8f3d-f4f942faca31', 'f48bf56b-a725-45d6-a0cb-d7fdc902e0c1',
  'eeca11e8-05ec-470e-ba82-104129d40d0c', 'ebe138fc-e309-49dc-849f-7f85d3142bee', 'dab2e49a-816e-458b-8d13-a2da21bbb3ff'
);
DELETE FROM clientes_grupos WHERE cliente_id IN (
  '0134a6b4-210d-4e51-83d2-cd8f82933d7b', '5d2fbbeb-4396-4970-9606-a5c0ada5ef4a', 'fb76cade-80c8-48d5-b7d4-d5bc88617c08',
  '8f04b2ff-ca11-493f-854d-b97aea1cf321', 'b30ee2a0-bdc4-4192-8f3d-f4f942faca31', 'f48bf56b-a725-45d6-a0cb-d7fdc902e0c1',
  'eeca11e8-05ec-470e-ba82-104129d40d0c', 'ebe138fc-e309-49dc-849f-7f85d3142bee', 'dab2e49a-816e-458b-8d13-a2da21bbb3ff'
);
DELETE FROM clientes WHERE id IN (
  '0134a6b4-210d-4e51-83d2-cd8f82933d7b', '5d2fbbeb-4396-4970-9606-a5c0ada5ef4a', 'fb76cade-80c8-48d5-b7d4-d5bc88617c08',
  '8f04b2ff-ca11-493f-854d-b97aea1cf321', 'b30ee2a0-bdc4-4192-8f3d-f4f942faca31', 'f48bf56b-a725-45d6-a0cb-d7fdc902e0c1',
  'eeca11e8-05ec-470e-ba82-104129d40d0c', 'ebe138fc-e309-49dc-849f-7f85d3142bee', 'dab2e49a-816e-458b-8d13-a2da21bbb3ff'
);

-- 5. HOSPITAL DE MEDICINA ESPECIALIZADA S/A (canônico: 5941f043-7871-4e05-9643-2900ce735c15)
UPDATE processos SET cliente_id = '5941f043-7871-4e05-9643-2900ce735c15', nome_cliente_envolvido = 'Hospital de Medicina Especializada S/A' WHERE cliente_id IN (
  '745d7fa0-c251-4deb-baa3-2c65c0397c62', -- Globalização, Hospital de Medicina Especializada S/A
  '45f78374-3eb7-4d01-bf8b-7c3420664eb4', -- Globalização,Hospital de Medicina Especializada S/A
  'e75e4d81-57c1-47df-b8ea-34a82896a00c', -- Hospital de Medicina Especializada S/A, Brasanitas
  'f55fdd4e-505a-4958-a51e-4b3848ec297a', -- Hospital de Medicina Especializada S/A, COMER DIETAS
  'a171f440-37f4-4442-a7d5-db9b20efbbfe', -- Hospital de Medicina Especializada S/A, Globalização
  'aa10f539-0bda-483f-a5b3-b3134a976c34', -- Hospital de Medicina Especializada S/A, Globalização Empresa...
  'c862a660-8b78-4d54-bd4d-fdad2fe566b0', -- HME
  '150d3afb-929b-4fbc-ba5d-8cb29ecda90a', -- HME, Brasanitas
  '872e80c0-ada0-412a-a482-7f68aa1a2c71', -- HME, COMER DIETAS
  '097ff41f-c813-4651-9382-e9060c04f8f0', -- HME, Globalização
  'fc6d66e7-3a4d-4d33-b49c-29c743df1a15', -- HME, Globalização, TOP SERVICE, GPS PARTICIPAÇÕES
  '10d08574-948e-435a-914d-182f3458a871', -- HME, Hot Cozinha
  '6f8d299f-664c-4f73-8476-fc44b6a1e30f', -- HME, ORTOPÉDICO
  '93ff3a7b-bec8-4084-a88a-54531f4a726d', -- HME, TOP SERVICE
  '21e68bfa-4aa2-41ac-a397-30668e7ee9e2', -- HME, WAW SERVICOS ESTERILIZAÇÃO
  'c012ca2d-b660-4599-b56a-78c1693a9e2c', -- BRASANITAS, HME
  '7b0610d8-adca-47d8-9e55-282dcc6d9e61', -- Globalização, HME
  'ae61f782-7f71-476a-a715-178f28d038f2', -- Globalização Facilities, HME
  'dbdce2ec-cb2c-4b1f-b365-e31de40a7085'  -- Hospital de medicina especializada
);
UPDATE pastas SET cliente_id = '5941f043-7871-4e05-9643-2900ce735c15' WHERE cliente_id IN (
  '745d7fa0-c251-4deb-baa3-2c65c0397c62', '45f78374-3eb7-4d01-bf8b-7c3420664eb4', 'e75e4d81-57c1-47df-b8ea-34a82896a00c',
  'f55fdd4e-505a-4958-a51e-4b3848ec297a', 'a171f440-37f4-4442-a7d5-db9b20efbbfe', 'aa10f539-0bda-483f-a5b3-b3134a976c34',
  'c862a660-8b78-4d54-bd4d-fdad2fe566b0', '150d3afb-929b-4fbc-ba5d-8cb29ecda90a', '872e80c0-ada0-412a-a482-7f68aa1a2c71',
  '097ff41f-c813-4651-9382-e9060c04f8f0', 'fc6d66e7-3a4d-4d33-b49c-29c743df1a15', '10d08574-948e-435a-914d-182f3458a871',
  '6f8d299f-664c-4f73-8476-fc44b6a1e30f', '93ff3a7b-bec8-4084-a88a-54531f4a726d', '21e68bfa-4aa2-41ac-a397-30668e7ee9e2',
  'c012ca2d-b660-4599-b56a-78c1693a9e2c', '7b0610d8-adca-47d8-9e55-282dcc6d9e61', 'ae61f782-7f71-476a-a715-178f28d038f2',
  'dbdce2ec-cb2c-4b1f-b365-e31de40a7085'
);
DELETE FROM clientes_grupos WHERE cliente_id IN (
  '745d7fa0-c251-4deb-baa3-2c65c0397c62', '45f78374-3eb7-4d01-bf8b-7c3420664eb4', 'e75e4d81-57c1-47df-b8ea-34a82896a00c',
  'f55fdd4e-505a-4958-a51e-4b3848ec297a', 'a171f440-37f4-4442-a7d5-db9b20efbbfe', 'aa10f539-0bda-483f-a5b3-b3134a976c34',
  'c862a660-8b78-4d54-bd4d-fdad2fe566b0', '150d3afb-929b-4fbc-ba5d-8cb29ecda90a', '872e80c0-ada0-412a-a482-7f68aa1a2c71',
  '097ff41f-c813-4651-9382-e9060c04f8f0', 'fc6d66e7-3a4d-4d33-b49c-29c743df1a15', '10d08574-948e-435a-914d-182f3458a871',
  '6f8d299f-664c-4f73-8476-fc44b6a1e30f', '93ff3a7b-bec8-4084-a88a-54531f4a726d', '21e68bfa-4aa2-41ac-a397-30668e7ee9e2',
  'c012ca2d-b660-4599-b56a-78c1693a9e2c', '7b0610d8-adca-47d8-9e55-282dcc6d9e61', 'ae61f782-7f71-476a-a715-178f28d038f2',
  'dbdce2ec-cb2c-4b1f-b365-e31de40a7085'
);
DELETE FROM clientes WHERE id IN (
  '745d7fa0-c251-4deb-baa3-2c65c0397c62', '45f78374-3eb7-4d01-bf8b-7c3420664eb4', 'e75e4d81-57c1-47df-b8ea-34a82896a00c',
  'f55fdd4e-505a-4958-a51e-4b3848ec297a', 'a171f440-37f4-4442-a7d5-db9b20efbbfe', 'aa10f539-0bda-483f-a5b3-b3134a976c34',
  'c862a660-8b78-4d54-bd4d-fdad2fe566b0', '150d3afb-929b-4fbc-ba5d-8cb29ecda90a', '872e80c0-ada0-412a-a482-7f68aa1a2c71',
  '097ff41f-c813-4651-9382-e9060c04f8f0', 'fc6d66e7-3a4d-4d33-b49c-29c743df1a15', '10d08574-948e-435a-914d-182f3458a871',
  '6f8d299f-664c-4f73-8476-fc44b6a1e30f', '93ff3a7b-bec8-4084-a88a-54531f4a726d', '21e68bfa-4aa2-41ac-a397-30668e7ee9e2',
  'c012ca2d-b660-4599-b56a-78c1693a9e2c', '7b0610d8-adca-47d8-9e55-282dcc6d9e61', 'ae61f782-7f71-476a-a715-178f28d038f2',
  'dbdce2ec-cb2c-4b1f-b365-e31de40a7085'
);

-- 6. CLÍNICA SANTA ROSA LTDA (canônico: 46ea397f-ab2b-4368-9fb4-8d754ddb12d8)
UPDATE processos SET cliente_id = '46ea397f-ab2b-4368-9fb4-8d754ddb12d8', nome_cliente_envolvido = 'Clínica Santa Rosa LTDA' WHERE cliente_id IN (
  'e7bcf171-9aa9-4f77-bd30-91a36c2f40e7', -- Clinica Santa Rosa LTDA (Hospital de Medicina Especializada S/A)
  '874d41d6-3cbe-4855-a69b-02253fcd42ab'  -- CSR
);
UPDATE pastas SET cliente_id = '46ea397f-ab2b-4368-9fb4-8d754ddb12d8' WHERE cliente_id IN ('e7bcf171-9aa9-4f77-bd30-91a36c2f40e7', '874d41d6-3cbe-4855-a69b-02253fcd42ab');
DELETE FROM clientes_grupos WHERE cliente_id IN ('e7bcf171-9aa9-4f77-bd30-91a36c2f40e7', '874d41d6-3cbe-4855-a69b-02253fcd42ab');
DELETE FROM clientes WHERE id IN ('e7bcf171-9aa9-4f77-bd30-91a36c2f40e7', '874d41d6-3cbe-4855-a69b-02253fcd42ab');

-- 7. MEDGRUPO PARTICIPAÇÕES - Criar cliente canônico e mesclar ALT, MEDGRUPO
INSERT INTO clientes (id, nome, tipo) VALUES ('00000000-0000-0000-0000-000000000001', 'Medgrupo Participações', 'juridica')
ON CONFLICT (id) DO NOTHING;
UPDATE processos SET cliente_id = '00000000-0000-0000-0000-000000000001', nome_cliente_envolvido = 'Medgrupo Participações' WHERE cliente_id = '65a79115-6f0c-44d3-83b6-42138f71ac1e';
UPDATE pastas SET cliente_id = '00000000-0000-0000-0000-000000000001' WHERE cliente_id = '65a79115-6f0c-44d3-83b6-42138f71ac1e';
DELETE FROM clientes_grupos WHERE cliente_id = '65a79115-6f0c-44d3-83b6-42138f71ac1e';
DELETE FROM clientes WHERE id = '65a79115-6f0c-44d3-83b6-42138f71ac1e';

-- 8. HOSPITAL SANTA LÚCIA S/A (canônico: 13b8eeea-b7db-438d-b1c7-9f1b4c625c53)
UPDATE processos SET cliente_id = '13b8eeea-b7db-438d-b1c7-9f1b4c625c53', nome_cliente_envolvido = 'Hospital Santa Lúcia S/A' WHERE cliente_id IN (
  '4e3a1aa8-79dc-4da9-8784-df1629f3034b', -- HSL, Diagnostico da America S/A, IMPAR...
  'ddd44931-6165-4457-a462-ff95674087e2', -- HSL, Sistema de Emergencia Movel de Brasilia
  '6e6560cf-0bc7-4a9c-a994-722288293ef8', -- HSL, Sistema de Emergencia Movel...Rio
  'f5b50983-9836-4a4c-bc32-0f43833307c5', -- Hospital Santa Lucia S/A, Sistema...
  '2d0c2c75-f69c-4325-a447-fa47e278ee40', -- HSL, GLOBALIZAÇÃO, TOP SERVICE
  '0b6b40f8-a823-4027-997b-e33e4729a6f2', -- HSL, Juízo 06ª VT Brasilia
  '06ee6332-6003-48dd-9295-0e0898910057', -- HSL, PETRUS GASTRONOMIA...
  'a6f5b771-0c35-4211-87ca-e7564c9180ad', -- HSL, HPN, HEMOTEC, HSH
  'fa8d8211-8eca-4eaf-b59d-e373d4e89fb3', -- GLOBALIZAÇÃO, HSL
  '14bfeea0-6dcc-4a9e-8da4-f92d47e1a587', -- HSL, HSS, SODEXO
  '5acb087b-01d1-45ce-898c-ad52a4dafc7a', -- Alt informatica, HSL
  '1d31ba5c-b776-4a2d-a9e3-3e0bdc182eb9', -- HSL, HOT COZINHA INDUSTRIAL TLDA
  'd342dc11-b4cc-4bdd-a63c-27d52bf691f0', -- HSL, HMA
  '8d705c89-732a-4e45-acb0-26a0a282daf0', -- HSL, HSH
  '63ad0b0c-52b2-4bc5-914f-0336d4f72138', -- HMA, HSL
  '89c59a71-974e-403f-b40b-3cd4dae775eb', -- HSL, GLOBALIZAÇÃO
  'c6b19a07-6945-4b7a-9f71-7384354c4f13', -- HSL, Julia Motoboys...
  'e69b1424-d8a2-480b-80a4-83c5fbbdacee', -- HSL, CRG, ATOM SERVIÇOS...
  '95c73237-2193-4433-9be2-5351057fa0dc', -- HSL,CRB,UNIÃO, GLOBALIZAÇÃO
  '2399cef4-fc7f-4a43-8d71-1c8254254561', -- HSL, TOP SERVICE
  'fee2ae37-c7b3-4bb7-80eb-19024f1c49c4', -- HSL, BRASANITAS
  '568754d7-7546-4512-923e-f7316059783a', -- HSL, GRUPO NBM COMUNICAÇÃO...
  '02af2392-3429-43ef-8488-54b4793dab09', -- HSL, 5 Estrelas Sistema de Seguranca
  '6fba062b-4b3d-4369-ac79-b5489d9b2ada', -- HSL, GLOBALIZAÇÃO, GRABER SISTEMAS
  '7184b321-f198-4987-820a-d784ba1a5490', -- HSL, Door Tech Comercio...
  'ca6c5ecd-ba26-4263-8474-f8b9ebc63957', -- HSL, HPN
  '923afbbb-1d30-4519-b753-21e564653e69', -- HSL, PETRUS, LA HOTELS
  '5fb4b538-39e3-4e17-9593-2d4b98316e49', -- HSL, HPN, HMA, HSH
  '2e9e44d5-6221-4d9f-a00b-07734dcd230a', -- HSL, HPN, HMA
  'ae8c6469-a1f5-4e1f-9dfc-d4841dc92350', -- HSL, JP Leal Servicos...
  '08cdc53b-6287-4788-9519-b4618a682597', -- HSL, Globalização Empresa de Serviços...
  'cb54e9e9-a885-42e6-86f3-4fe4cf2778f0', -- HSL, ATOM
  'a2e4adc1-34b3-478d-bdb8-950fad6f50ac', -- HSL, PETRUS, RCOKS, SANOLO...
  '4972b859-76ae-4405-aec1-c4486e625cf5', -- HSL, HSH e HMA
  '885b3c0e-628e-4193-a1db-160a63b6062b', -- HSL, HSH, HMA
  '38f2ef78-8646-4413-8e8c-8b273d3ed359', -- HSLN, HOT COZINHA INDUSTRIAL TLDA
  '1eb49f86-adc3-463b-96e8-0917331a3bdb', -- HSL (SANTA LUCIA NORTE)
  '7072ea54-b4cf-4f03-b5ba-41bdd386e4af', -- HSL, Tec Life Serviços Tecnicos...
  'fb9ce7ac-9950-403c-a7c5-66a335e6d73b', -- HSL, Top Service, Radio e Televisão...
  'e4b83643-41b9-4132-b7f3-174072abd20b', -- HSL, HMA, FOX
  '2028a560-8864-46a2-bd9e-b83d75fd42e3', -- HSL, Hemotec, HPN
  '66465950-941f-4997-9dfd-08947e9095ac', -- HSL, Diagnosticos da America S/A
  '4f70692d-ecb9-4b79-b228-666388ef4183', -- HSL
  '91aab644-32ad-4f6a-9daf-ad46665af86a', -- HSL, HOT COZINHA
  '7a237097-c049-40ae-93d7-34e4595a0907', -- Hospital Santa Lucia S/A, BIOXXI...
  '1e9572f2-9bd3-4972-b3f3-ffe5267d3be9', -- Hospital Santa Lucia S/A, TOP SERVICE...
  'e3a1b553-823d-4d3c-8bfc-5a63b2b24b23'  -- HSL, LR Apoio Administrativo...
);
UPDATE pastas SET cliente_id = '13b8eeea-b7db-438d-b1c7-9f1b4c625c53' WHERE cliente_id IN (
  '4e3a1aa8-79dc-4da9-8784-df1629f3034b', 'ddd44931-6165-4457-a462-ff95674087e2', '6e6560cf-0bc7-4a9c-a994-722288293ef8',
  'f5b50983-9836-4a4c-bc32-0f43833307c5', '2d0c2c75-f69c-4325-a447-fa47e278ee40', '0b6b40f8-a823-4027-997b-e33e4729a6f2',
  '06ee6332-6003-48dd-9295-0e0898910057', 'a6f5b771-0c35-4211-87ca-e7564c9180ad', 'fa8d8211-8eca-4eaf-b59d-e373d4e89fb3',
  '14bfeea0-6dcc-4a9e-8da4-f92d47e1a587', '5acb087b-01d1-45ce-898c-ad52a4dafc7a', '1d31ba5c-b776-4a2d-a9e3-3e0bdc182eb9',
  'd342dc11-b4cc-4bdd-a63c-27d52bf691f0', '8d705c89-732a-4e45-acb0-26a0a282daf0', '63ad0b0c-52b2-4bc5-914f-0336d4f72138',
  '89c59a71-974e-403f-b40b-3cd4dae775eb', 'c6b19a07-6945-4b7a-9f71-7384354c4f13', 'e69b1424-d8a2-480b-80a4-83c5fbbdacee',
  '95c73237-2193-4433-9be2-5351057fa0dc', '2399cef4-fc7f-4a43-8d71-1c8254254561', 'fee2ae37-c7b3-4bb7-80eb-19024f1c49c4',
  '568754d7-7546-4512-923e-f7316059783a', '02af2392-3429-43ef-8488-54b4793dab09', '6fba062b-4b3d-4369-ac79-b5489d9b2ada',
  '7184b321-f198-4987-820a-d784ba1a5490', 'ca6c5ecd-ba26-4263-8474-f8b9ebc63957', '923afbbb-1d30-4519-b753-21e564653e69',
  '5fb4b538-39e3-4e17-9593-2d4b98316e49', '2e9e44d5-6221-4d9f-a00b-07734dcd230a', 'ae8c6469-a1f5-4e1f-9dfc-d4841dc92350',
  '08cdc53b-6287-4788-9519-b4618a682597', 'cb54e9e9-a885-42e6-86f3-4fe4cf2778f0', 'a2e4adc1-34b3-478d-bdb8-950fad6f50ac',
  '4972b859-76ae-4405-aec1-c4486e625cf5', '885b3c0e-628e-4193-a1db-160a63b6062b', '38f2ef78-8646-4413-8e8c-8b273d3ed359',
  '1eb49f86-adc3-463b-96e8-0917331a3bdb', '7072ea54-b4cf-4f03-b5ba-41bdd386e4af', 'fb9ce7ac-9950-403c-a7c5-66a335e6d73b',
  'e4b83643-41b9-4132-b7f3-174072abd20b', '2028a560-8864-46a2-bd9e-b83d75fd42e3', '66465950-941f-4997-9dfd-08947e9095ac',
  '4f70692d-ecb9-4b79-b228-666388ef4183', '91aab644-32ad-4f6a-9daf-ad46665af86a', '7a237097-c049-40ae-93d7-34e4595a0907',
  '1e9572f2-9bd3-4972-b3f3-ffe5267d3be9', 'e3a1b553-823d-4d3c-8bfc-5a63b2b24b23'
);
DELETE FROM clientes_grupos WHERE cliente_id IN (
  '4e3a1aa8-79dc-4da9-8784-df1629f3034b', 'ddd44931-6165-4457-a462-ff95674087e2', '6e6560cf-0bc7-4a9c-a994-722288293ef8',
  'f5b50983-9836-4a4c-bc32-0f43833307c5', '2d0c2c75-f69c-4325-a447-fa47e278ee40', '0b6b40f8-a823-4027-997b-e33e4729a6f2',
  '06ee6332-6003-48dd-9295-0e0898910057', 'a6f5b771-0c35-4211-87ca-e7564c9180ad', 'fa8d8211-8eca-4eaf-b59d-e373d4e89fb3',
  '14bfeea0-6dcc-4a9e-8da4-f92d47e1a587', '5acb087b-01d1-45ce-898c-ad52a4dafc7a', '1d31ba5c-b776-4a2d-a9e3-3e0bdc182eb9',
  'd342dc11-b4cc-4bdd-a63c-27d52bf691f0', '8d705c89-732a-4e45-acb0-26a0a282daf0', '63ad0b0c-52b2-4bc5-914f-0336d4f72138',
  '89c59a71-974e-403f-b40b-3cd4dae775eb', 'c6b19a07-6945-4b7a-9f71-7384354c4f13', 'e69b1424-d8a2-480b-80a4-83c5fbbdacee',
  '95c73237-2193-4433-9be2-5351057fa0dc', '2399cef4-fc7f-4a43-8d71-1c8254254561', 'fee2ae37-c7b3-4bb7-80eb-19024f1c49c4',
  '568754d7-7546-4512-923e-f7316059783a', '02af2392-3429-43ef-8488-54b4793dab09', '6fba062b-4b3d-4369-ac79-b5489d9b2ada',
  '7184b321-f198-4987-820a-d784ba1a5490', 'ca6c5ecd-ba26-4263-8474-f8b9ebc63957', '923afbbb-1d30-4519-b753-21e564653e69',
  '5fb4b538-39e3-4e17-9593-2d4b98316e49', '2e9e44d5-6221-4d9f-a00b-07734dcd230a', 'ae8c6469-a1f5-4e1f-9dfc-d4841dc92350',
  '08cdc53b-6287-4788-9519-b4618a682597', 'cb54e9e9-a885-42e6-86f3-4fe4cf2778f0', 'a2e4adc1-34b3-478d-bdb8-950fad6f50ac',
  '4972b859-76ae-4405-aec1-c4486e625cf5', '885b3c0e-628e-4193-a1db-160a63b6062b', '38f2ef78-8646-4413-8e8c-8b273d3ed359',
  '1eb49f86-adc3-463b-96e8-0917331a3bdb', '7072ea54-b4cf-4f03-b5ba-41bdd386e4af', 'fb9ce7ac-9950-403c-a7c5-66a335e6d73b',
  'e4b83643-41b9-4132-b7f3-174072abd20b', '2028a560-8864-46a2-bd9e-b83d75fd42e3', '66465950-941f-4997-9dfd-08947e9095ac',
  '4f70692d-ecb9-4b79-b228-666388ef4183', '91aab644-32ad-4f6a-9daf-ad46665af86a', '7a237097-c049-40ae-93d7-34e4595a0907',
  '1e9572f2-9bd3-4972-b3f3-ffe5267d3be9', 'e3a1b553-823d-4d3c-8bfc-5a63b2b24b23'
);
DELETE FROM clientes WHERE id IN (
  '4e3a1aa8-79dc-4da9-8784-df1629f3034b', 'ddd44931-6165-4457-a462-ff95674087e2', '6e6560cf-0bc7-4a9c-a994-722288293ef8',
  'f5b50983-9836-4a4c-bc32-0f43833307c5', '2d0c2c75-f69c-4325-a447-fa47e278ee40', '0b6b40f8-a823-4027-997b-e33e4729a6f2',
  '06ee6332-6003-48dd-9295-0e0898910057', 'a6f5b771-0c35-4211-87ca-e7564c9180ad', 'fa8d8211-8eca-4eaf-b59d-e373d4e89fb3',
  '14bfeea0-6dcc-4a9e-8da4-f92d47e1a587', '5acb087b-01d1-45ce-898c-ad52a4dafc7a', '1d31ba5c-b776-4a2d-a9e3-3e0bdc182eb9',
  'd342dc11-b4cc-4bdd-a63c-27d52bf691f0', '8d705c89-732a-4e45-acb0-26a0a282daf0', '63ad0b0c-52b2-4bc5-914f-0336d4f72138',
  '89c59a71-974e-403f-b40b-3cd4dae775eb', 'c6b19a07-6945-4b7a-9f71-7384354c4f13', 'e69b1424-d8a2-480b-80a4-83c5fbbdacee',
  '95c73237-2193-4433-9be2-5351057fa0dc', '2399cef4-fc7f-4a43-8d71-1c8254254561', 'fee2ae37-c7b3-4bb7-80eb-19024f1c49c4',
  '568754d7-7546-4512-923e-f7316059783a', '02af2392-3429-43ef-8488-54b4793dab09', '6fba062b-4b3d-4369-ac79-b5489d9b2ada',
  '7184b321-f198-4987-820a-d784ba1a5490', 'ca6c5ecd-ba26-4263-8474-f8b9ebc63957', '923afbbb-1d30-4519-b753-21e564653e69',
  '5fb4b538-39e3-4e17-9593-2d4b98316e49', '2e9e44d5-6221-4d9f-a00b-07734dcd230a', 'ae8c6469-a1f5-4e1f-9dfc-d4841dc92350',
  '08cdc53b-6287-4788-9519-b4618a682597', 'cb54e9e9-a885-42e6-86f3-4fe4cf2778f0', 'a2e4adc1-34b3-478d-bdb8-950fad6f50ac',
  '4972b859-76ae-4405-aec1-c4486e625cf5', '885b3c0e-628e-4193-a1db-160a63b6062b', '38f2ef78-8646-4413-8e8c-8b273d3ed359',
  '1eb49f86-adc3-463b-96e8-0917331a3bdb', '7072ea54-b4cf-4f03-b5ba-41bdd386e4af', 'fb9ce7ac-9950-403c-a7c5-66a335e6d73b',
  'e4b83643-41b9-4132-b7f3-174072abd20b', '2028a560-8864-46a2-bd9e-b83d75fd42e3', '66465950-941f-4997-9dfd-08947e9095ac',
  '4f70692d-ecb9-4b79-b228-666388ef4183', '91aab644-32ad-4f6a-9daf-ad46665af86a', '7a237097-c049-40ae-93d7-34e4595a0907',
  '1e9572f2-9bd3-4972-b3f3-ffe5267d3be9', 'e3a1b553-823d-4d3c-8bfc-5a63b2b24b23'
);

-- 9. HOSPITAL PRONTONORTE S/A (canônico: 14903b58-333a-44c7-93f4-410a700eb1bc)
UPDATE processos SET cliente_id = '14903b58-333a-44c7-93f4-410a700eb1bc', nome_cliente_envolvido = 'Hospital Prontonorte S/A' WHERE cliente_id IN (
  '93dbeffc-cb39-4c5c-b708-b77ab25bffe5', -- HPN
  '871e625b-755a-4f20-a8b2-49ecb2d82292', -- HPN, ALT INFORMATICA
  'e44c4503-97e2-4b24-8834-047f0ac15850', -- HPN, HSH
  'c27e2f38-d8f1-44ba-8df9-cdc84c9dd1a6', -- HPN, Intensifisio Assistência...
  'a2559607-5bb3-45b1-a415-e79cecaa1c99', -- HPN, HSL, TOP SERVICE
  '0ec90506-16dd-40ca-82b5-401c158ed0c5', -- HPN, Hemotec e HSL
  'e1d3e5da-ac91-418b-be9f-589be2552a88', -- Hospital Prontonorte S/A, Ânima Centro Hospitalar LTDA
  'a1a5f2df-a92e-430e-a8d9-4c7e80f9a23e', -- KATHEDRAL, HPN
  '28be5e94-c814-4d4d-9b63-cfec96efb9ae', -- HPN, TOP SERVICE
  'c8a0a23c-ca48-4e4b-9780-de1e9e0d97e1'  -- HPN, Pronto Imagem Serviços Radiológicos
);
UPDATE pastas SET cliente_id = '14903b58-333a-44c7-93f4-410a700eb1bc' WHERE cliente_id IN (
  '93dbeffc-cb39-4c5c-b708-b77ab25bffe5', '871e625b-755a-4f20-a8b2-49ecb2d82292', 'e44c4503-97e2-4b24-8834-047f0ac15850',
  'c27e2f38-d8f1-44ba-8df9-cdc84c9dd1a6', 'a2559607-5bb3-45b1-a415-e79cecaa1c99', '0ec90506-16dd-40ca-82b5-401c158ed0c5',
  'e1d3e5da-ac91-418b-be9f-589be2552a88', 'a1a5f2df-a92e-430e-a8d9-4c7e80f9a23e', '28be5e94-c814-4d4d-9b63-cfec96efb9ae',
  'c8a0a23c-ca48-4e4b-9780-de1e9e0d97e1'
);
DELETE FROM clientes_grupos WHERE cliente_id IN (
  '93dbeffc-cb39-4c5c-b708-b77ab25bffe5', '871e625b-755a-4f20-a8b2-49ecb2d82292', 'e44c4503-97e2-4b24-8834-047f0ac15850',
  'c27e2f38-d8f1-44ba-8df9-cdc84c9dd1a6', 'a2559607-5bb3-45b1-a415-e79cecaa1c99', '0ec90506-16dd-40ca-82b5-401c158ed0c5',
  'e1d3e5da-ac91-418b-be9f-589be2552a88', 'a1a5f2df-a92e-430e-a8d9-4c7e80f9a23e', '28be5e94-c814-4d4d-9b63-cfec96efb9ae',
  'c8a0a23c-ca48-4e4b-9780-de1e9e0d97e1'
);
DELETE FROM clientes WHERE id IN (
  '93dbeffc-cb39-4c5c-b708-b77ab25bffe5', '871e625b-755a-4f20-a8b2-49ecb2d82292', 'e44c4503-97e2-4b24-8834-047f0ac15850',
  'c27e2f38-d8f1-44ba-8df9-cdc84c9dd1a6', 'a2559607-5bb3-45b1-a415-e79cecaa1c99', '0ec90506-16dd-40ca-82b5-401c158ed0c5',
  'e1d3e5da-ac91-418b-be9f-589be2552a88', 'a1a5f2df-a92e-430e-a8d9-4c7e80f9a23e', '28be5e94-c814-4d4d-9b63-cfec96efb9ae',
  'c8a0a23c-ca48-4e4b-9780-de1e9e0d97e1'
);

-- 10. HOSPITAL SANTA ROSA (canônico: fa70b8ce-675f-4d08-b211-5b0a7484d420 - HSR)
UPDATE clientes SET nome = 'Hospital Santa Rosa' WHERE id = 'fa70b8ce-675f-4d08-b211-5b0a7484d420';
UPDATE processos SET cliente_id = 'fa70b8ce-675f-4d08-b211-5b0a7484d420', nome_cliente_envolvido = 'Hospital Santa Rosa' WHERE cliente_id IN (
  '02e9799a-c34d-48b3-9ef7-448bd7d84922', -- BRASANITAS, HSR
  '28ac6f4e-7403-4fdc-8107-68c23c46d7ae'  -- COMER DIETAS E REFEIÇÕES LTDA, HSR
);
UPDATE pastas SET cliente_id = 'fa70b8ce-675f-4d08-b211-5b0a7484d420' WHERE cliente_id IN ('02e9799a-c34d-48b3-9ef7-448bd7d84922', '28ac6f4e-7403-4fdc-8107-68c23c46d7ae');
DELETE FROM clientes_grupos WHERE cliente_id IN ('02e9799a-c34d-48b3-9ef7-448bd7d84922', '28ac6f4e-7403-4fdc-8107-68c23c46d7ae');
DELETE FROM clientes WHERE id IN ('02e9799a-c34d-48b3-9ef7-448bd7d84922', '28ac6f4e-7403-4fdc-8107-68c23c46d7ae');