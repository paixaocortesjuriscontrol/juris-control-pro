ALTER TABLE public.pedidos_processo
  ADD COLUMN IF NOT EXISTS resultado_sentenca TEXT,
  ADD COLUMN IF NOT EXISTS resultado_recurso TEXT,
  ADD COLUMN IF NOT EXISTS turma TEXT,
  ADD COLUMN IF NOT EXISTS relator TEXT;

COMMENT ON COLUMN public.pedidos_processo.resultado_sentenca IS 'Resultado da sentença: improcedente, procedente ou parcialmente procedente';
COMMENT ON COLUMN public.pedidos_processo.resultado_recurso IS 'Resultado do recurso: provido, parcialmente provido ou não provido';
COMMENT ON COLUMN public.pedidos_processo.turma IS 'Turma julgadora relacionada ao pedido/recurso';
COMMENT ON COLUMN public.pedidos_processo.relator IS 'Relator relacionado ao pedido/recurso';