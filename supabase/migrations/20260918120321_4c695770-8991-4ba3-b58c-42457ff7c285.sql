CREATE TABLE public.item_cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_item text NOT NULL,
  item_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  simbolo text NOT NULL DEFAULT 'C',
  comentario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_cobrancas TO authenticated;
GRANT ALL ON public.item_cobrancas TO service_role;

ALTER TABLE public.item_cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_cobrancas_select" ON public.item_cobrancas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "item_cobrancas_insert_own" ON public.item_cobrancas
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "item_cobrancas_delete_own" ON public.item_cobrancas
  FOR DELETE TO authenticated USING (usuario_id = auth.uid());

CREATE INDEX idx_item_cobrancas_item ON public.item_cobrancas (item_id);
CREATE INDEX idx_item_cobrancas_usuario_data ON public.item_cobrancas (usuario_id, created_at DESC);