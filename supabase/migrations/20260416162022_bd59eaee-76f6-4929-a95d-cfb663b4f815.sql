CREATE TABLE public.partes_processo_benner (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dados_benner_id uuid NOT NULL REFERENCES public.dados_benner(id) ON DELETE CASCADE,
  nome text NOT NULL,
  documento text,
  tipo_pessoa text,
  polo text,
  is_advogado boolean DEFAULT false,
  origem text DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.partes_processo_benner ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage partes"
  ON public.partes_processo_benner
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_partes_processo_benner_updated_at
  BEFORE UPDATE ON public.partes_processo_benner
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();