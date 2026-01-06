-- Primeiro, remover duplicatas mantendo apenas a mais antiga
DELETE FROM publicacoes_djen_processos a
USING publicacoes_djen_processos b
WHERE a.hash_conteudo = b.hash_conteudo
  AND a.created_at > b.created_at;

-- Adicionar constraint UNIQUE para evitar duplicatas futuras
ALTER TABLE publicacoes_djen_processos 
ADD CONSTRAINT publicacoes_djen_processos_hash_unique UNIQUE (hash_conteudo);