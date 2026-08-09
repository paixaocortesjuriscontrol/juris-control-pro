CREATE UNIQUE INDEX IF NOT EXISTS processos_numero_uidx
  ON public.processos (numero)
  WHERE numero IS NOT NULL AND numero <> '';