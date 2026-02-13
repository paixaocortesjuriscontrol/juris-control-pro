
UPDATE processos
SET monitorar_djen = true
WHERE coordenacao_id = '3e47fc83-3539-4fa7-9fcf-33825120e1b7'
  AND (monitorar_djen = false OR monitorar_djen IS NULL);
