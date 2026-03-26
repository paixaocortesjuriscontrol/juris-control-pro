INSERT INTO public.processos (numero, coordenacao_id, cliente_id, area, status, polo_passivo)
VALUES 
  ('0061100-18.2009.5.17.0009', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'a3077898-a9b5-4361-90d1-e788102e78a5', 'trabalhista', 'ativo', 'BANCO BRADESCO S.A.'),
  ('0148000-61.1999.5.01.0021', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'a3077898-a9b5-4361-90d1-e788102e78a5', 'trabalhista', 'ativo', 'BANCO BRADESCO S.A.'),
  ('0010310-27.2022.5.03.0021', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'a3077898-a9b5-4361-90d1-e788102e78a5', 'trabalhista', 'ativo', 'BANCO BRADESCO S.A.'),
  ('0007315-45.2025.5.05.0000', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'a3077898-a9b5-4361-90d1-e788102e78a5', 'trabalhista', 'ativo', 'BANCO BRADESCO S.A.'),
  ('0000102-78.2023.5.14.0041', 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f', 'a3077898-a9b5-4361-90d1-e788102e78a5', 'trabalhista', 'ativo', 'BANCO BRADESCO S.A.')
ON CONFLICT (numero) DO UPDATE SET 
  coordenacao_id = EXCLUDED.coordenacao_id,
  cliente_id = EXCLUDED.cliente_id;