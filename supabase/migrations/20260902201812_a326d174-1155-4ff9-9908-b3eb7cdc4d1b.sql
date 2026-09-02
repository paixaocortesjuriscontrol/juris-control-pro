CREATE TABLE public.pedidos_por_dossie (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dossie text NOT NULL,
  pedido text NOT NULL,
  pedido_normalizado text NOT NULL,
  origem text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_por_dossie TO authenticated;
GRANT ALL ON public.pedidos_por_dossie TO service_role;

ALTER TABLE public.pedidos_por_dossie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver pedidos por dossie"
ON public.pedidos_por_dossie FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins e coordenadores gerenciam pedidos por dossie"
ON public.pedidos_por_dossie FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE UNIQUE INDEX pedidos_por_dossie_unq ON public.pedidos_por_dossie (dossie, pedido_normalizado);
CREATE INDEX pedidos_por_dossie_dossie_idx ON public.pedidos_por_dossie (dossie);

CREATE TRIGGER update_pedidos_por_dossie_updated_at
BEFORE UPDATE ON public.pedidos_por_dossie
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();