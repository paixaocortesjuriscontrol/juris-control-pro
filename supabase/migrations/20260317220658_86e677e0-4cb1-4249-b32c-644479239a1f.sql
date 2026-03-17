-- Fix broken hora values that contain "1899" from old imports
UPDATE audiencias_detectadas
SET 
  hora = CASE 
    WHEN hora LIKE '%1899%' THEN 
      SUBSTRING(hora FROM '(\d{2}:\d{2}):\d{2}')
    ELSE hora
  END,
  hora_local = CASE 
    WHEN hora_local LIKE '%1899%' THEN 
      SUBSTRING(hora_local FROM '(\d{2}:\d{2}):\d{2}')
    ELSE hora_local
  END,
  hora_brasilia = CASE 
    WHEN hora_brasilia LIKE '%1899%' THEN 
      SUBSTRING(hora_brasilia FROM '(\d{2}:\d{2}):\d{2}')
    ELSE hora_brasilia
  END
WHERE hora LIKE '%1899%' OR hora_local LIKE '%1899%' OR hora_brasilia LIKE '%1899%';