DELETE FROM audiencias_detectadas 
WHERE origem = 'manual' AND (processo_numero IS NULL OR processo_numero = '');