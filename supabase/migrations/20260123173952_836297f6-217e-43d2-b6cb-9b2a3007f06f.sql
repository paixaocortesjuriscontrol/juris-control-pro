
-- Primeiro, remover referência de cliente_id das pastas dos clientes sem processos
UPDATE pastas
SET cliente_id = NULL
WHERE cliente_id IN (
  SELECT c.id 
  FROM clientes c
  LEFT JOIN processos p ON p.cliente_id = c.id
  WHERE p.id IS NULL
);

-- Depois, excluir os clientes sem processos
DELETE FROM clientes
WHERE id NOT IN (
  SELECT DISTINCT cliente_id 
  FROM processos 
  WHERE cliente_id IS NOT NULL
);
