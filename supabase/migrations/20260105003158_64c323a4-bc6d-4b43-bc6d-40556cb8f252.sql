-- Atualizar todos os processos do cliente "Hospital Santa Lucia S/A" (sem acento)
-- para apontar para "Hospital Santa Lúcia S/A" (com acento)
UPDATE processos 
SET cliente_id = '13b8eeea-b7db-438d-b1c7-9f1b4c625c53'
WHERE cliente_id = 'aab3915c-11b8-4f2c-82a3-36cfc3394d82';

-- Mover vínculos de grupos do cliente antigo para o novo (se houver)
UPDATE clientes_grupos 
SET cliente_id = '13b8eeea-b7db-438d-b1c7-9f1b4c625c53'
WHERE cliente_id = 'aab3915c-11b8-4f2c-82a3-36cfc3394d82'
AND NOT EXISTS (
  SELECT 1 FROM clientes_grupos cg2 
  WHERE cg2.cliente_id = '13b8eeea-b7db-438d-b1c7-9f1b4c625c53' 
  AND cg2.grupo_id = clientes_grupos.grupo_id
);

-- Remover vínculos duplicados
DELETE FROM clientes_grupos 
WHERE cliente_id = 'aab3915c-11b8-4f2c-82a3-36cfc3394d82';

-- Mover vínculos de pastas
UPDATE pastas 
SET cliente_id = '13b8eeea-b7db-438d-b1c7-9f1b4c625c53'
WHERE cliente_id = 'aab3915c-11b8-4f2c-82a3-36cfc3394d82';

-- Remover o cliente duplicado
DELETE FROM clientes 
WHERE id = 'aab3915c-11b8-4f2c-82a3-36cfc3394d82';