-- Unificação de perfis duplicados para Jhonatan Gonçalves
-- Perfil destino: 41294d81-47c9-40f4-9ad5-37f431c702a2 (Jhonatan Gonçalves)
-- Perfis duplicados:
--   - 17cfc596-b672-4b9e-8544-ac0c986f3d9a (JHONATAN GONCALVES TRAB)
--   - ebd0f2e3-8b36-4523-baea-a6dd06307ef4 (Jhonantan)

-- 1. Migrar tarefas do perfil duplicado (JHONATAN GONCALVES TRAB) para o destino
UPDATE tarefas 
SET responsavel_id = '41294d81-47c9-40f4-9ad5-37f431c702a2'
WHERE responsavel_id = '17cfc596-b672-4b9e-8544-ac0c986f3d9a';

-- 2. Migrar tarefas do perfil duplicado (Jhonantan) para o destino
UPDATE tarefas 
SET responsavel_id = '41294d81-47c9-40f4-9ad5-37f431c702a2'
WHERE responsavel_id = 'ebd0f2e3-8b36-4523-baea-a6dd06307ef4';

-- 3. Migrar processos (advogado_responsavel_id) dos duplicados
UPDATE processos 
SET advogado_responsavel_id = '41294d81-47c9-40f4-9ad5-37f431c702a2'
WHERE advogado_responsavel_id = '17cfc596-b672-4b9e-8544-ac0c986f3d9a';

UPDATE processos 
SET advogado_responsavel_id = '41294d81-47c9-40f4-9ad5-37f431c702a2'
WHERE advogado_responsavel_id = 'ebd0f2e3-8b36-4523-baea-a6dd06307ef4';

-- 4. Migrar processos_responsaveis dos duplicados (evitando duplicatas)
UPDATE processos_responsaveis 
SET usuario_id = '41294d81-47c9-40f4-9ad5-37f431c702a2'
WHERE usuario_id = '17cfc596-b672-4b9e-8544-ac0c986f3d9a'
  AND NOT EXISTS (
    SELECT 1 FROM processos_responsaveis pr2 
    WHERE pr2.processo_id = processos_responsaveis.processo_id 
      AND pr2.usuario_id = '41294d81-47c9-40f4-9ad5-37f431c702a2'
  );

UPDATE processos_responsaveis 
SET usuario_id = '41294d81-47c9-40f4-9ad5-37f431c702a2'
WHERE usuario_id = 'ebd0f2e3-8b36-4523-baea-a6dd06307ef4'
  AND NOT EXISTS (
    SELECT 1 FROM processos_responsaveis pr2 
    WHERE pr2.processo_id = processos_responsaveis.processo_id 
      AND pr2.usuario_id = '41294d81-47c9-40f4-9ad5-37f431c702a2'
  );

-- 5. Remover registros redundantes em processos_responsaveis
DELETE FROM processos_responsaveis 
WHERE usuario_id IN ('17cfc596-b672-4b9e-8544-ac0c986f3d9a', 'ebd0f2e3-8b36-4523-baea-a6dd06307ef4');

-- 6. Remover membros_coordenacao duplicados
DELETE FROM membros_coordenacao 
WHERE usuario_id = '17cfc596-b672-4b9e-8544-ac0c986f3d9a';

DELETE FROM membros_coordenacao 
WHERE usuario_id = 'ebd0f2e3-8b36-4523-baea-a6dd06307ef4';

-- 7. Migrar comentários de tarefas
UPDATE comentarios_tarefas 
SET autor_id = '41294d81-47c9-40f4-9ad5-37f431c702a2'
WHERE autor_id IN ('17cfc596-b672-4b9e-8544-ac0c986f3d9a', 'ebd0f2e3-8b36-4523-baea-a6dd06307ef4');

-- 8. Migrar eventos_agenda
UPDATE eventos_agenda 
SET criado_por = '41294d81-47c9-40f4-9ad5-37f431c702a2'
WHERE criado_por IN ('17cfc596-b672-4b9e-8544-ac0c986f3d9a', 'ebd0f2e3-8b36-4523-baea-a6dd06307ef4');

-- 9. Migrar documentos
UPDATE documentos 
SET uploaded_by = '41294d81-47c9-40f4-9ad5-37f431c702a2'
WHERE uploaded_by IN ('17cfc596-b672-4b9e-8544-ac0c986f3d9a', 'ebd0f2e3-8b36-4523-baea-a6dd06307ef4');

-- 10. Desativar perfis duplicados (não deletar para evitar problemas de FK)
UPDATE profiles 
SET ativo = false, 
    nome = nome || ' [DUPLICADO - MIGRADO]'
WHERE id IN ('17cfc596-b672-4b9e-8544-ac0c986f3d9a', 'ebd0f2e3-8b36-4523-baea-a6dd06307ef4');