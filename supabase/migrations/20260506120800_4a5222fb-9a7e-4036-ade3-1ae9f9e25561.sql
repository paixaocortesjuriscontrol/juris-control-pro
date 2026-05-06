ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS distribuido_em timestamptz,
  ADD COLUMN IF NOT EXISTS distribuido_por uuid,
  ADD COLUMN IF NOT EXISTS prazo_entrega date,
  ADD COLUMN IF NOT EXISTS status_distribuicao text DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS entregue_em timestamptz,
  ADD COLUMN IF NOT EXISTS entregue_por uuid,
  ADD COLUMN IF NOT EXISTS observacao_distribuicao text;

CREATE INDEX IF NOT EXISTS idx_dados_benner_status_distribuicao ON public.dados_benner(status_distribuicao);
CREATE INDEX IF NOT EXISTS idx_dados_benner_prazo_entrega ON public.dados_benner(prazo_entrega);
CREATE INDEX IF NOT EXISTS idx_dados_benner_distribuido_em ON public.dados_benner(distribuido_em);