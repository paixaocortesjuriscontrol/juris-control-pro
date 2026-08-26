CREATE TABLE public.materias_pedidos_oficiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.materias_pedidos_oficiais TO authenticated;
GRANT ALL ON public.materias_pedidos_oficiais TO service_role;
ALTER TABLE public.materias_pedidos_oficiais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários logados podem ler a lista oficial" ON public.materias_pedidos_oficiais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Apenas service role altera a lista oficial" ON public.materias_pedidos_oficiais FOR ALL TO service_role USING (true) WITH CHECK (true);