-- Atualizar processos do "Anima Centro Hospitalar" para "Ânima Centro Hospitalar LTDA"
UPDATE processos 
SET cliente_id = '0a6106c5-6d55-4131-bf58-b8098518e8a4'
WHERE cliente_id = 'cd04a08c-90e9-46a2-b4e9-09e42ab26eca';

-- Atualizar processos do "Anima Centro Hospitalar Ltda" para "Ânima Centro Hospitalar LTDA"
UPDATE processos 
SET cliente_id = '0a6106c5-6d55-4131-bf58-b8098518e8a4'
WHERE cliente_id = 'cba2bbb3-9d58-4c27-ad8d-d356afb0e1f2';

-- Mover vínculos de grupos
UPDATE clientes_grupos 
SET cliente_id = '0a6106c5-6d55-4131-bf58-b8098518e8a4'
WHERE cliente_id IN ('cd04a08c-90e9-46a2-b4e9-09e42ab26eca', 'cba2bbb3-9d58-4c27-ad8d-d356afb0e1f2')
AND NOT EXISTS (
  SELECT 1 FROM clientes_grupos cg2 
  WHERE cg2.cliente_id = '0a6106c5-6d55-4131-bf58-b8098518e8a4' 
  AND cg2.grupo_id = clientes_grupos.grupo_id
);

-- Remover vínculos duplicados
DELETE FROM clientes_grupos 
WHERE cliente_id IN ('cd04a08c-90e9-46a2-b4e9-09e42ab26eca', 'cba2bbb3-9d58-4c27-ad8d-d356afb0e1f2');

-- Mover vínculos de pastas
UPDATE pastas 
SET cliente_id = '0a6106c5-6d55-4131-bf58-b8098518e8a4'
WHERE cliente_id IN ('cd04a08c-90e9-46a2-b4e9-09e42ab26eca', 'cba2bbb3-9d58-4c27-ad8d-d356afb0e1f2');

-- Remover os clientes duplicados
DELETE FROM clientes 
WHERE id IN ('cd04a08c-90e9-46a2-b4e9-09e42ab26eca', 'cba2bbb3-9d58-4c27-ad8d-d356afb0e1f2');

-- Corrigir o nome para "Ânima Centro Hospitalar Ltda"
UPDATE clientes 
SET nome = 'Ânima Centro Hospitalar Ltda'
WHERE id = '0a6106c5-6d55-4131-bf58-b8098518e8a4';