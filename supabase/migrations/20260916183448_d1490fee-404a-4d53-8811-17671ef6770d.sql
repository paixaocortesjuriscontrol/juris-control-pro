CREATE UNIQUE INDEX IF NOT EXISTS uniq_pedidos_por_dossie_dossie_pedido
  ON public.pedidos_por_dossie (dossie, pedido_normalizado);

CREATE TABLE public.pedidos_por_dossie_cargas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  arquivo text NOT NULL,
  dossies integer NOT NULL DEFAULT 0,
  pedidos_novos integer NOT NULL DEFAULT 0,
  pedidos_existentes integer NOT NULL DEFAULT 0,
  importado_por uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.pedidos_por_dossie_cargas TO authenticated;
GRANT ALL ON public.pedidos_por_dossie_cargas TO service_role;

ALTER TABLE public.pedidos_por_dossie_cargas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver cargas"
  ON public.pedidos_por_dossie_cargas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuario registra a propria carga"
  ON public.pedidos_por_dossie_cargas FOR INSERT TO authenticated
  WITH CHECK (importado_por = auth.uid());

CREATE TRIGGER update_pedidos_por_dossie_cargas_updated_at
  BEFORE UPDATE ON public.pedidos_por_dossie_cargas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();