-- Update all processes with active andamentos monitoring to also enable DJEN monitoring
UPDATE processos 
SET monitorar_djen = true 
WHERE monitorar_andamentos = true 
  AND (monitorar_djen = false OR monitorar_djen IS NULL);