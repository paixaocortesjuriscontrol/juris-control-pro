-- Unificação de perfis: Julia Rocha (sem acento) -> Júlia Rocha (com acento)
-- Perfil a manter: 70b1c350-35ef-4025-b295-679f8cb947b1 (Júlia Rocha)
-- Perfil a remover: 7d025921-fc4c-422a-bbe5-18adb274a6c6 (Julia Rocha - placeholder)

-- 1. Atualizar tarefas
UPDATE tarefas 
SET responsavel_id = '70b1c350-35ef-4025-b295-679f8cb947b1'
WHERE responsavel_id = '7d025921-fc4c-422a-bbe5-18adb274a6c6';

-- 2. Atualizar processos (advogado_responsavel_id legado)
UPDATE processos 
SET advogado_responsavel_id = '70b1c350-35ef-4025-b295-679f8cb947b1'
WHERE advogado_responsavel_id = '7d025921-fc4c-422a-bbe5-18adb274a6c6';

-- 3. Atualizar processos_responsaveis (evitar duplicatas)
UPDATE processos_responsaveis 
SET usuario_id = '70b1c350-35ef-4025-b295-679f8cb947b1'
WHERE usuario_id = '7d025921-fc4c-422a-bbe5-18adb274a6c6'
AND processo_id NOT IN (
    SELECT processo_id FROM processos_responsaveis 
    WHERE usuario_id = '70b1c350-35ef-4025-b295-679f8cb947b1'
);

-- 4. Remover vínculos duplicados em processos_responsaveis
DELETE FROM processos_responsaveis 
WHERE usuario_id = '7d025921-fc4c-422a-bbe5-18adb274a6c6';

-- 5. Atualizar membros_coordenacao (evitar duplicatas)
UPDATE membros_coordenacao 
SET usuario_id = '70b1c350-35ef-4025-b295-679f8cb947b1'
WHERE usuario_id = '7d025921-fc4c-422a-bbe5-18adb274a6c6'
AND coordenacao_id NOT IN (
    SELECT coordenacao_id FROM membros_coordenacao 
    WHERE usuario_id = '70b1c350-35ef-4025-b295-679f8cb947b1'
);

-- 6. Remover vínculos duplicados em membros_coordenacao
DELETE FROM membros_coordenacao 
WHERE usuario_id = '7d025921-fc4c-422a-bbe5-18adb274a6c6';

-- 7. Remover o perfil duplicado
DELETE FROM profiles 
WHERE id = '7d025921-fc4c-422a-bbe5-18adb274a6c6';