-- Corrigir a UF dos monitoramentos DJEN da Santander Cível para DF
UPDATE public.monitoramentos_djen
SET uf = 'DF'
WHERE id IN (
  'd2bdec2b-4020-4630-9699-7303e150acf6',  -- CARLOS JOSE ELISAS JUNIOR
  '7a95ce05-599c-46bc-b611-e72f167d479d'   -- OSMAR MENDES PAIXAO CORTES
);