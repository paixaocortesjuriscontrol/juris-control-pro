
-- Cadastrar todos os responsáveis de prazos na Coordenação Dr. Jhonatan
INSERT INTO public.membros_coordenacao (coordenacao_id, usuario_id, cargo)
VALUES 
  ('968631d0-6659-46f1-b45d-899892cb0121', '4cc7df37-46ea-41b3-8a6d-ac4feadbc231', 'Advogado'), -- Loren Barbosa
  ('968631d0-6659-46f1-b45d-899892cb0121', '94f52ddf-6dbc-4df0-8902-0677a108e2de', 'Advogado'), -- Paulo Melgaço
  ('968631d0-6659-46f1-b45d-899892cb0121', '17b7d8f6-18f6-4f62-93b1-94a278adc241', 'Advogado'), -- Beatriz Serafim
  ('968631d0-6659-46f1-b45d-899892cb0121', '6d4279a6-6e0b-40a3-94da-857159bba06c', 'Advogado'), -- Lídia Araújo
  ('968631d0-6659-46f1-b45d-899892cb0121', 'cede5dc2-9df9-49c9-a41c-f664e8a78b72', 'Advogado'), -- Renata Aguiar
  ('968631d0-6659-46f1-b45d-899892cb0121', 'e731382b-ab60-4809-afd2-127446a2ffd8', 'Advogado'), -- Isabela Constantino
  ('968631d0-6659-46f1-b45d-899892cb0121', 'd6eee7a2-507d-463e-ad39-574eb806eab2', 'Advogado'), -- Geovana Araújo
  ('968631d0-6659-46f1-b45d-899892cb0121', '9f54546b-b2bb-46f1-a302-8f1f60641b27', 'Advogado'), -- Lis Ribeiro
  ('968631d0-6659-46f1-b45d-899892cb0121', '8a645465-d456-40c4-9161-2b289e6da4dd', 'Advogado'), -- Vanessa Ferreira
  ('968631d0-6659-46f1-b45d-899892cb0121', 'dca8c368-44a3-4624-b572-d06f4595c80f', 'Advogado'), -- Larissa Martins
  ('968631d0-6659-46f1-b45d-899892cb0121', '3d0d1432-3a64-4bb5-ab48-3e664d15d073', 'Advogado'), -- Thiago Almeida
  ('968631d0-6659-46f1-b45d-899892cb0121', '2dbeae15-7d18-4a1f-8365-67033d2f15a1', 'Advogado'), -- Marcelo Chaves
  ('968631d0-6659-46f1-b45d-899892cb0121', '90d359b6-c87c-403b-8e69-effd2d02c8cc', 'Advogado'), -- Narjara Batista
  ('968631d0-6659-46f1-b45d-899892cb0121', '9c1b63ec-a70f-4a95-861d-9f8785d063e8', 'Advogado'), -- Giovanna Campana
  ('968631d0-6659-46f1-b45d-899892cb0121', '511b4fe6-1a05-43f7-a003-4866ba776757', 'Advogado'), -- Lucas Calabria
  ('968631d0-6659-46f1-b45d-899892cb0121', 'bc02a624-ae25-4efc-8707-8b252886f0bc', 'Advogado') -- Altina Clemente
ON CONFLICT DO NOTHING;
