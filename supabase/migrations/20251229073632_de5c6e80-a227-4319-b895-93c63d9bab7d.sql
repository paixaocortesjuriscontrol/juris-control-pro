-- Aumenta capacidade de valor_causa (evita numeric field overflow)
ALTER TABLE public.processos
  ALTER COLUMN valor_causa TYPE numeric(30,2)
  USING CASE
    WHEN valor_causa IS NULL THEN NULL
    ELSE round(valor_causa::numeric, 2)
  END;