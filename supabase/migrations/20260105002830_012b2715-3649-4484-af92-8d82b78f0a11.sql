-- Atualizar todos os processos do cliente "Centro Radiológico de Brasília" 
-- para apontar para "Centro Radiológico de Brasília S/A"
UPDATE processos 
SET cliente_id = 'e0205533-f816-4b8e-80bc-8768a2213bf9'
WHERE cliente_id = '4cfe87f5-e06c-4ad9-8a65-4e5ae816e266';

-- Mover vínculos de grupos do cliente antigo para o novo (se houver)
UPDATE clientes_grupos 
SET cliente_id = 'e0205533-f816-4b8e-80bc-8768a2213bf9'
WHERE cliente_id = '4cfe87f5-e06c-4ad9-8a65-4e5ae816e266'
AND NOT EXISTS (
  SELECT 1 FROM clientes_grupos cg2 
  WHERE cg2.cliente_id = 'e0205533-f816-4b8e-80bc-8768a2213bf9' 
  AND cg2.grupo_id = clientes_grupos.grupo_id
);

-- Remover vínculos duplicados que não puderam ser movidos
DELETE FROM clientes_grupos 
WHERE cliente_id = '4cfe87f5-e06c-4ad9-8a65-4e5ae816e266';

-- Mover vínculos de pastas (se houver)
UPDATE pastas 
SET cliente_id = 'e0205533-f816-4b8e-80bc-8768a2213bf9'
WHERE cliente_id = '4cfe87f5-e06c-4ad9-8a65-4e5ae816e266';

-- Remover o cliente duplicado
DELETE FROM clientes 
WHERE id = '4cfe87f5-e06c-4ad9-8a65-4e5ae816e266';