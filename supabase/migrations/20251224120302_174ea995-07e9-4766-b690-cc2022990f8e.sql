-- Corrigir tipos de monitoramento que não são reconhecidos pela edge function
-- 'nome' e 'parte' devem ser 'palavra-chave' para funcionar corretamente

UPDATE monitoramentos_djen 
SET tipo = 'palavra-chave' 
WHERE tipo IN ('nome', 'parte');