-- 1) Primeiro identificar quais pastas serão mantidas (a primeira de cada nome)
-- e atualizar os processos para apontar para elas
WITH pasta_principal AS (
  SELECT DISTINCT ON (nome) 
    id as pasta_mantida_id,
    nome
  FROM pastas
  ORDER BY nome, created_at ASC
),
pastas_duplicadas AS (
  SELECT p.id as pasta_duplicada_id, pp.pasta_mantida_id
  FROM pastas p
  INNER JOIN pasta_principal pp ON p.nome = pp.nome
  WHERE p.id != pp.pasta_mantida_id
)
UPDATE processos 
SET pasta_id = pd.pasta_mantida_id
FROM pastas_duplicadas pd
WHERE processos.pasta_id = pd.pasta_duplicada_id;

-- 2) Atualizar documentos da mesma forma
WITH pasta_principal AS (
  SELECT DISTINCT ON (nome) 
    id as pasta_mantida_id,
    nome
  FROM pastas
  ORDER BY nome, created_at ASC
),
pastas_duplicadas AS (
  SELECT p.id as pasta_duplicada_id, pp.pasta_mantida_id
  FROM pastas p
  INNER JOIN pasta_principal pp ON p.nome = pp.nome
  WHERE p.id != pp.pasta_mantida_id
)
UPDATE documentos 
SET pasta_id = pd.pasta_mantida_id
FROM pastas_duplicadas pd
WHERE documentos.pasta_id = pd.pasta_duplicada_id;

-- 3) Agora deletar as pastas duplicadas (que já não têm mais referências)
WITH pasta_principal AS (
  SELECT DISTINCT ON (nome) 
    id as pasta_mantida_id,
    nome
  FROM pastas
  ORDER BY nome, created_at ASC
)
DELETE FROM pastas 
WHERE id NOT IN (SELECT pasta_mantida_id FROM pasta_principal);

-- 4) Criar índice único em pastas.nome
CREATE UNIQUE INDEX IF NOT EXISTS pastas_nome_unique_idx ON pastas (nome);