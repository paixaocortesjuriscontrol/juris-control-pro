
-- Limpeza de duplicados na tabela dados_benner
-- Estratégia:
-- 1. Para cada processo, classificar dossiê: válido, placeholder, nulo
-- 2. Se há ao menos 1 válido E há registros com placeholder/nulo SEM judit_preenchido → deletar esses placeholder/nulo
-- 3. Para processos onde NENHUM registro tem dossiê válido e há mais de 1 registro → manter apenas 1 (preferindo judit=true, depois mais antigo)

WITH classificado AS (
  SELECT 
    id, processo, dossie, judit_preenchido, created_at,
    CASE 
      WHEN dossie IS NULL THEN 'nulo'
      WHEN UPPER(TRIM(dossie)) IN ('NÃO LOCALIZADO','NAO LOCALIZADO','DOSSIÊ NÃO LOCALIZADO','DOSSIE NAO LOCALIZADO','NÃO ENCONTRADO','NAO ENCONTRADO','-----','--','-','SEM ACESSO AO BENNER') THEN 'placeholder'
      ELSE 'valido'
    END as tipo_dossie
  FROM dados_benner 
  WHERE processo IS NOT NULL
),
proc_tem_valido AS (
  SELECT DISTINCT processo FROM classificado WHERE tipo_dossie = 'valido'
),
-- Grupo A: deletar placeholder/nulo SEM judit quando existe válido
del_grupo_a AS (
  SELECT c.id
  FROM classificado c
  JOIN proc_tem_valido v ON v.processo = c.processo
  WHERE c.tipo_dossie IN ('nulo', 'placeholder')
    AND COALESCE(c.judit_preenchido, false) = false
),
-- Grupo B: processos sem nenhum válido — manter apenas o "melhor"
proc_sem_valido AS (
  SELECT processo
  FROM classificado
  GROUP BY processo
  HAVING COUNT(*) > 1 AND COUNT(*) FILTER (WHERE tipo_dossie = 'valido') = 0
),
ranked_grupo_b AS (
  SELECT c.id, c.processo,
    ROW_NUMBER() OVER (
      PARTITION BY c.processo 
      ORDER BY 
        COALESCE(c.judit_preenchido, false) DESC,
        CASE c.tipo_dossie WHEN 'placeholder' THEN 1 WHEN 'nulo' THEN 2 END,
        c.created_at ASC
    ) as rn
  FROM classificado c
  JOIN proc_sem_valido p ON p.processo = c.processo
),
del_grupo_b AS (
  SELECT id FROM ranked_grupo_b WHERE rn > 1
),
ids_para_deletar AS (
  SELECT id FROM del_grupo_a
  UNION
  SELECT id FROM del_grupo_b
)
DELETE FROM dados_benner
WHERE id IN (SELECT id FROM ids_para_deletar);
