ALTER TABLE public.coordenacoes ADD COLUMN IF NOT EXISTS usar_feriados_nacionais boolean NOT NULL DEFAULT false;

CREATE TABLE public.feriados_coordenacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenacao_id uuid NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  data date NOT NULL,
  nome text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coordenacao_id, data)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feriados_coordenacao TO authenticated;
GRANT ALL ON public.feriados_coordenacao TO service_role;
ALTER TABLE public.feriados_coordenacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ler feriados da coordenação" ON public.feriados_coordenacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gerir feriados da coordenação" ON public.feriados_coordenacao FOR ALL TO authenticated
  USING (public._pode_gerir_coordenacao(coordenacao_id))
  WITH CHECK (public._pode_gerir_coordenacao(coordenacao_id));